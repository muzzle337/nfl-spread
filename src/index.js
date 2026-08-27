import { classifyGame, focusGrade, settleAgainstSpread } from "./engine.js";
import { ingestWeeklySpreads } from "./ingestion.js";
import { fetchNflSpreads } from "./odds.js";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};

const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    ...corsHeaders,
    ...extraHeaders
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
        version: "0.3.0",
        database,
        oddsApiConfigured: Boolean(env.ODDS_API_KEY)
      });
    }

    if (url.pathname === "/api/engine/demo") {
      return json({
        classification: classifyGame(-3.5, 3.5),
        settlement: settleAgainstSpread({ awaySpread: -3.5, homeSpread: 3.5, awayScore: 24, homeScore: 17 }),
        grade: focusGrade(64)
      });
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
      if (!env.ODDS_API_KEY) return json({ error: "Odds API is not configured" }, 503);
      if (!env.DB) return json({ error: "Database is not bound" }, 503);

      try {
        const result = await fetchNflSpreads({ apiKey: env.ODDS_API_KEY });
        const ingestion = await ingestWeeklySpreads(env.DB, result.games, new Date());
        await logApiUsage(env, {
          requestType: "nfl_ingest",
          quota: result.quota,
          triggerType: "manual",
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
          triggerType: "manual",
          success: false
        });
        return json({
          error: "Unable to ingest NFL spreads",
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
