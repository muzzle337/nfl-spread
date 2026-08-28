import { adminIngestPage, isAdminAuthorized } from "./admin.js";
import { consensusLinesForWeek } from "./consensus.js";
import { classifyGame, focusGrade, settleAgainstSpread } from "./engine.js";
import { ingestWeeklySpreads } from "./ingestion.js";
import { fetchNflScores, fetchNflSpreads } from "./odds.js";
import { projectionsForWeek } from "./projection.js";
import { ingestCompletedScores } from "./results.js";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-admin-token"
};

const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    ...corsHeaders,
    ...extraHeaders
  }
});

const html = (body, status = 200) => new Response(body, {
  status,
  headers: {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  }
});

async function logApiUsage(env, { requestType, quota, triggerType = "manual", success = true }) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(`
      INSERT INTO api_usage(provider, request_type, credits_used, credits_remaining, trigger_type, success)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      "the-odds-api",
      requestType,
      quota?.creditsUsedThisRequest ?? 0,
      quota?.creditsRemaining ?? null,
      triggerType,
      success ? 1 : 0
    ).run();
  } catch (error) {
    console.error("API usage logging failed", error);
  }
}

async function usageSummary(env) {
  if (!env.DB) throw new Error("Database is not bound");
  const totals = await env.DB.prepare(`
    SELECT
      COALESCE(SUM(credits_used), 0) AS tracked_credits,
      COUNT(*) AS requests,
      COALESCE(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END), 0) AS failed_requests
    FROM api_usage
    WHERE requested_at >= datetime('now', 'start of month')
  `).first();

  const latest = await env.DB.prepare(`
    SELECT credits_remaining, requested_at
    FROM api_usage
    WHERE credits_remaining IS NOT NULL
    ORDER BY id DESC
    LIMIT 1
  `).first();

  const byType = await env.DB.prepare(`
    SELECT request_type, COUNT(*) AS requests, COALESCE(SUM(credits_used), 0) AS credits
    FROM api_usage
    WHERE requested_at >= datetime('now', 'start of month')
    GROUP BY request_type
    ORDER BY credits DESC, request_type ASC
  `).all();

  return {
    month: new Date().toISOString().slice(0, 7),
    requests: Number(totals?.requests ?? 0),
    trackedCredits: Number(totals?.tracked_credits ?? 0),
    failedRequests: Number(totals?.failed_requests ?? 0),
    creditsRemaining: latest?.credits_remaining ?? null,
    remainingAsOf: latest?.requested_at ?? null,
    byType: byType.results ?? []
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      let database = "unbound";
      if (env.DB) {
        try {
          await env.DB.prepare("SELECT 1").first();
          database = "ok";
        } catch {
          database = "error";
        }
      }
      return json({
        ok: true,
        service: "nfl-spread-api",
        version: "0.4.1",
        database,
        oddsApiConfigured: Boolean(env.ODDS_API_KEY),
        adminIngestConfigured: Boolean(env.INGEST_ADMIN_TOKEN)
      });
    }

    if (url.pathname === "/admin/ingest" && request.method === "GET") {
      return html(adminIngestPage());
    }

    if (url.pathname === "/api/engine/demo") {
      return json({
        classification: classifyGame(-3.5, 3.5),
        settlement: settleAgainstSpread({ awaySpread: -3.5, homeSpread: 3.5, awayScore: 24, homeScore: 17 }),
        grade: focusGrade(64)
      });
    }

    if (url.pathname === "/api/consensus/nfl" && request.method === "GET") {
      if (!env.DB) return json({ error: "Database is not bound" }, 503);
      const season = url.searchParams.get("season");
      const week = url.searchParams.get("week");
      if (!season || !week) return json({ error: "season and week are required" }, 400);

      try {
        return json({ ok: true, ...(await consensusLinesForWeek(env.DB, season, week)) }, 200, {
          "cache-control": "no-store"
        });
      } catch (error) {
        return json({ error: "Consensus lines unavailable", message: error.message }, 400);
      }
    }

    if (url.pathname === "/api/projections/nfl" && request.method === "GET") {
      if (!env.DB) return json({ error: "Database is not bound" }, 503);
      const season = url.searchParams.get("season");
      const week = url.searchParams.get("week");
      if (!season || !week) return json({ error: "season and week are required" }, 400);

      try {
        return json({ ok: true, ...(await projectionsForWeek(env.DB, season, week)) }, 200, {
          "cache-control": "no-store"
        });
      } catch (error) {
        return json({ error: "Projection data unavailable", message: error.message }, 400);
      }
    }

    if (url.pathname === "/api/odds/nfl" && request.method === "GET") {
      if (!env.ODDS_API_KEY) return json({ error: "Odds API is not configured" }, 503);

      try {
        const result = await fetchNflSpreads({ apiKey: env.ODDS_API_KEY });
        await logApiUsage(env, { requestType: "nfl_spreads", quota: result.quota, success: true });
        return json({
          ok: true,
          fetchedAt: new Date().toISOString(),
          gameCount: result.games.length,
          quota: result.quota,
          games: result.games
        }, 200, { "cache-control": "no-store" });
      } catch (error) {
        await logApiUsage(env, { requestType: "nfl_spreads", quota: error.quota, success: false });
        return json({
          error: "Unable to fetch NFL spreads",
          message: error.message,
          quota: error.quota ?? null
        }, error.status && error.status >= 400 && error.status < 600 ? error.status : 502);
      }
    }

    if (url.pathname === "/api/ingest/nfl" && request.method === "POST") {
      const auth = isAdminAuthorized(request, env);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      if (!env.ODDS_API_KEY) return json({ error: "Odds API is not configured" }, 503);
      if (!env.DB) return json({ error: "Database is not bound" }, 503);

      try {
        const result = await fetchNflSpreads({ apiKey: env.ODDS_API_KEY });
        const ingestion = await ingestWeeklySpreads(env.DB, result.games, new Date());
        await logApiUsage(env, {
          requestType: "nfl_ingest",
          quota: result.quota,
          triggerType: "admin_page",
          success: true
        });
        return json({
          ok: true,
          fetchedAt: new Date().toISOString(),
          quota: result.quota,
          ingestion
        }, 200, { "cache-control": "no-store" });
      } catch (error) {
        await logApiUsage(env, {
          requestType: "nfl_ingest",
          quota: error.quota,
          triggerType: "admin_page",
          success: false
        });
        return json({
          error: "Unable to ingest NFL spreads",
          message: error.message,
          quota: error.quota ?? null
        }, error.status && error.status >= 400 && error.status < 600 ? error.status : 502);
      }
    }

    if (url.pathname === "/api/ingest/nfl/results" && request.method === "POST") {
      const auth = isAdminAuthorized(request, env);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      if (!env.ODDS_API_KEY) return json({ error: "Odds API is not configured" }, 503);
      if (!env.DB) return json({ error: "Database is not bound" }, 503);

      try {
        const result = await fetchNflScores({ apiKey: env.ODDS_API_KEY, daysFrom: 3 });
        const ingestion = await ingestCompletedScores(env.DB, result.games);
        await logApiUsage(env, {
          requestType: "nfl_results",
          quota: result.quota,
          triggerType: "admin_page",
          success: true
        });
        return json({
          ok: true,
          fetchedAt: new Date().toISOString(),
          lookbackDays: 3,
          quota: result.quota,
          ingestion
        }, 200, { "cache-control": "no-store" });
      } catch (error) {
        await logApiUsage(env, {
          requestType: "nfl_results",
          quota: error.quota,
          triggerType: "admin_page",
          success: false
        });
        return json({
          error: "Unable to ingest NFL results",
          message: error.message,
          quota: error.quota ?? null
        }, error.status && error.status >= 400 && error.status < 600 ? error.status : 502);
      }
    }

    if (url.pathname === "/api/usage" && request.method === "GET") {
      try {
        return json({ ok: true, ...(await usageSummary(env)) }, 200, { "cache-control": "no-store" });
      } catch (error) {
        return json({ error: "Usage data unavailable", message: error.message }, 503);
      }
    }

    return json({ error: "Not found" }, 404);
  }
};
