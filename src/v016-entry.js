import app from "./v015-entry.js";
import { contextForWeek } from "./context.js";
import { ensureContextSchema } from "./context-schema.js";
import { historicalIndicatorsForWeek } from "./history-matchups.js";
import { withHistoryMatchupUi } from "./history-matchup-ui.js";

export const APP_VERSION = "0.16.0";

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store", ...headers }
  });
}

function replaceKnownAppVersions(body) {
  return body
    .split("0.12.0").join(APP_VERSION)
    .split("0.13.0").join(APP_VERSION)
    .split("0.13.1").join(APP_VERSION)
    .split("0.13.2").join(APP_VERSION)
    .split("0.13.3").join(APP_VERSION)
    .split("0.14.0").join(APP_VERSION)
    .split("0.15.0").join(APP_VERSION);
}

async function matchupRoute(request, env, url) {
  if (url.pathname !== "/api/history/matchups") return null;
  if (request.method !== "GET") return json({ error:"Method not allowed" }, 405);
  if (!env.DB) return json({ error:"Database is not bound" }, 503);
  const season = Number(url.searchParams.get("season"));
  const week = Number(url.searchParams.get("week"));
  const startSeason = Number(url.searchParams.get("start") || 2015);
  const endSeason = Number(url.searchParams.get("end") || 2025);
  if (!Number.isInteger(season) || !Number.isInteger(week) || week < 1) return json({ error:"season and week are required" }, 400);
  try {
    await ensureContextSchema(env.DB);
    const context = await contextForWeek(env.DB, season, week);
    const games = await historicalIndicatorsForWeek(env.DB, context.games, { startSeason, endSeason });
    return json({
      ok:true,
      season,
      week,
      range:{ startSeason, endSeason },
      games,
      principle:"Historical indicators explain how coaches performed in comparable situations. They do not modify current-season spread or Survivor probabilities."
    });
  } catch (error) {
    return json({ error:"Historical matchup indicators unavailable", message:error.message }, 400);
  }
}

async function upgradeResponse(request, response) {
  const url = new URL(request.url);
  if (url.pathname === "/api/health") {
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== "object") return response;
    return json({
      ...body,
      version:APP_VERSION,
      historicalMatchupBridge:true,
      historicalMatchupRange:[2015,2025],
      historicalMatchupSignals:["coach-overall","primetime","home-away","short-rest","extra-rest","rest-advantage","cold-outdoor","hot-outdoor","windy-outdoor"],
      historicalMatchupAffectsPredictions:false
    }, response.status, response.headers);
  }
  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/app")) {
    if (!response.ok) return response;
    const body = replaceKnownAppVersions(await response.text());
    return new Response(withHistoryMatchupUi(body), { status:response.status, headers:response.headers });
  }
  if (request.method === "GET" && url.pathname === "/sw.js") {
    if (!response.ok) return response;
    return new Response(replaceKnownAppVersions(await response.text()), { status:response.status, headers:response.headers });
  }
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const matchup = await matchupRoute(request, env, url);
    if (matchup) return matchup;
    return upgradeResponse(request, await app.fetch(request, env, ctx));
  },
  scheduled(controller, env, ctx) { return app.scheduled(controller, env, ctx); }
};
