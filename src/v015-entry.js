import app from "./v014-entry.js";
import { isAdminSessionAuthorized } from "./admin-session.js";
import { historicalCoachIndicators, historyStatus, importHistoricalGames } from "./history.js";
import { withHistoryUi } from "./history-ui.js";

export const APP_VERSION = "0.15.0";

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store", ...headers } });
}

function replaceKnownAppVersions(body) {
  return body
    .split("0.12.0").join(APP_VERSION)
    .split("0.13.0").join(APP_VERSION)
    .split("0.13.1").join(APP_VERSION)
    .split("0.13.2").join(APP_VERSION)
    .split("0.13.3").join(APP_VERSION)
    .split("0.14.0").join(APP_VERSION);
}

async function historyRoute(request, env, url) {
  if (!url.pathname.startsWith("/api/history/")) return null;
  if (!env.DB) return json({ error:"Database is not bound" }, 503);
  if (url.pathname === "/api/history/status" && request.method === "GET") {
    return json({ ok:true, ...(await historyStatus(env.DB)) });
  }
  if (url.pathname === "/api/history/coach" && request.method === "GET") {
    const coach = url.searchParams.get("coach")?.trim();
    const startSeason = Number(url.searchParams.get("start") || 2015);
    const endSeason = Number(url.searchParams.get("end") || 2025);
    if (!coach) return json({ error:"coach is required" }, 400);
    try { return json({ ok:true, ...(await historicalCoachIndicators(env.DB, coach, { startSeason, endSeason })) }); }
    catch (error) { return json({ error:"Historical coach indicators unavailable", message:error.message }, 400); }
  }
  if (url.pathname === "/api/history/import" && request.method === "POST") {
    const auth = await isAdminSessionAuthorized(request, env);
    if (!auth.ok) return json({ error:auth.error }, auth.status);
    const startSeason = Number(url.searchParams.get("start") || 2015);
    const endSeason = Number(url.searchParams.get("end") || 2025);
    try { return json({ ok:true, ...(await importHistoricalGames(env.DB, { startSeason, endSeason })) }); }
    catch (error) { return json({ error:"Historical import failed", message:error.message }, 502); }
  }
  return json({ error:"Method not allowed" }, 405);
}

async function upgradeResponse(request, response) {
  const url = new URL(request.url);
  if (url.pathname === "/api/health") {
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== "object") return response;
    return json({ ...body, version:APP_VERSION, historicalIndicators:true, historicalRange:[2015,2025], historicalFields:["coach","record","spread","rest","roof","surface","temperature","wind","stadium","kickoff","primetime"], historicalAffectsPredictions:false }, response.status, response.headers);
  }
  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/app")) {
    if (!response.ok) return response;
    const body = replaceKnownAppVersions(await response.text());
    return new Response(withHistoryUi(body), { status:response.status, headers:response.headers });
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
    const history = await historyRoute(request, env, url);
    if (history) return history;
    return upgradeResponse(request, await app.fetch(request, env, ctx));
  },
  scheduled(controller, env, ctx) { return app.scheduled(controller, env, ctx); }
};
