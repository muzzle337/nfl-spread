import baseApp from "./pwa-entry.js";
import { isAdminAuthorized } from "./admin.js";
import { resolveDashboardWeek } from "./dashboard-data.js";
import { ingestWeeklySpreads } from "./ingestion.js";
import { withMoneylineSurvivorUi } from "./moneyline-survivor-ui.js";
import { fetchNflMarkets } from "./odds.js";
import {
  createSurvivorEntry,
  listSurvivorEntries,
  recordSurvivorPick,
  survivorRecommendations
} from "./survivor.js";

const APP_VERSION = "0.10.0";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-admin-token"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders
    }
  });
}

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

async function targetSeasonWeek(env, url) {
  const suppliedSeason = url.searchParams.get("season");
  const suppliedWeek = url.searchParams.get("week");
  if (suppliedSeason && suppliedWeek) return { season: Number(suppliedSeason), week: Number(suppliedWeek) };
  if (!env.DB) return { season: null, week: null };
  return resolveDashboardWeek(env.DB);
}

async function survivorRoute(request, env, url) {
  if (!env.DB) return json({ error: "Database is not bound" }, 503);

  if (url.pathname === "/api/survivor" && request.method === "GET") {
    const target = await targetSeasonWeek(env, url);
    if (!Number.isInteger(target.season) || !Number.isInteger(target.week)) {
      return json({ error: "No active NFL week is available" }, 400);
    }
    const entry = url.searchParams.get("entry");
    try {
      return json({ ok: true, ...(await survivorRecommendations(env.DB, target.season, target.week, entry)) });
    } catch (error) {
      return json({ error: "Survivor recommendations unavailable", message: error.message }, 400);
    }
  }

  if (url.pathname === "/api/survivor/entries" && request.method === "GET") {
    const season = Number(url.searchParams.get("season"));
    if (!Number.isInteger(season)) return json({ error: "season is required" }, 400);
    try {
      return json({ ok: true, season, entries: await listSurvivorEntries(env.DB, season) });
    } catch (error) {
      return json({ error: "Survivor entries unavailable", message: error.message }, 400);
    }
  }

  if (url.pathname === "/api/survivor/entries" && request.method === "POST") {
    const auth = isAdminAuthorized(request, env);
    if (!auth.ok) return json({ error: auth.error }, auth.status);
    const body = await request.json().catch(() => ({}));
    try {
      return json({ ok: true, entry: await createSurvivorEntry(env.DB, body.season, body.name) });
    } catch (error) {
      return json({ error: "Unable to create Survivor entry", message: error.message }, 400);
    }
  }

  if (url.pathname === "/api/survivor/picks" && request.method === "POST") {
    const auth = isAdminAuthorized(request, env);
    if (!auth.ok) return json({ error: auth.error }, auth.status);
    const body = await request.json().catch(() => ({}));
    try {
      return json({ ok: true, pick: await recordSurvivorPick(env.DB, body) });
    } catch (error) {
      return json({ error: "Unable to record Survivor pick", message: error.message }, 400);
    }
  }

  return null;
}

async function marketRoute(request, env, url) {
  if (url.pathname === "/api/odds/nfl" && request.method === "GET") {
    if (!env.ODDS_API_KEY) return json({ error: "Odds API is not configured" }, 503);
    try {
      const result = await fetchNflMarkets({ apiKey: env.ODDS_API_KEY });
      await logApiUsage(env, { requestType: "nfl_markets", quota: result.quota, success: true });
      return json({ ok: true, fetchedAt: new Date().toISOString(), gameCount: result.games.length, quota: result.quota, games: result.games });
    } catch (error) {
      await logApiUsage(env, { requestType: "nfl_markets", quota: error.quota, success: false });
      return json({ error: "Unable to fetch NFL markets", message: error.message, quota: error.quota ?? null }, error.status && error.status >= 400 && error.status < 600 ? error.status : 502);
    }
  }

  if (url.pathname === "/api/ingest/nfl" && request.method === "POST") {
    const auth = isAdminAuthorized(request, env);
    if (!auth.ok) return json({ error: auth.error }, auth.status);
    if (!env.ODDS_API_KEY) return json({ error: "Odds API is not configured" }, 503);
    if (!env.DB) return json({ error: "Database is not bound" }, 503);
    try {
      const result = await fetchNflMarkets({ apiKey: env.ODDS_API_KEY });
      const ingestion = await ingestWeeklySpreads(env.DB, result.games, new Date());
      await logApiUsage(env, { requestType: "nfl_ingest", quota: result.quota, triggerType: "admin_page", success: true });
      return json({ ok: true, fetchedAt: new Date().toISOString(), quota: result.quota, ingestion });
    } catch (error) {
      await logApiUsage(env, { requestType: "nfl_ingest", quota: error.quota, triggerType: "admin_page", success: false });
      return json({ error: "Unable to ingest NFL markets", message: error.message, quota: error.quota ?? null }, error.status && error.status >= 400 && error.status < 600 ? error.status : 502);
    }
  }

  return null;
}

function replacePublicVersion(value) {
  return String(value).split("0.9.0").join(APP_VERSION);
}

async function upgradeResponse(request, response) {
  const url = new URL(request.url);
  if (url.pathname === "/api/health") {
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== "object") return response;
    return json({ ...body, version: APP_VERSION, moneyline: true, survivor: true });
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/app")) {
    if (!response.ok) return response;
    const body = replacePublicVersion(await response.text());
    return new Response(withMoneylineSurvivorUi(body), { status: response.status, headers: response.headers });
  }

  if (request.method === "GET" && url.pathname === "/sw.js") {
    const body = replacePublicVersion(await response.text());
    return new Response(body, { status: response.status, headers: response.headers });
  }

  return response;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const url = new URL(request.url);

    const survivor = await survivorRoute(request, env, url);
    if (survivor) return survivor;

    const market = await marketRoute(request, env, url);
    if (market) return market;

    const response = await baseApp.fetch(request, env, ctx);
    return upgradeResponse(request, response);
  },

  scheduled(controller, env, ctx) {
    return baseApp.scheduled(controller, env, ctx);
  }
};
