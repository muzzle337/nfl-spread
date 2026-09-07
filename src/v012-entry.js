import app, { ensureDefaultSurvivorEntries } from "./v011-entry.js";
import { survivorAnalytics } from "./survivor-analytics.js";
import { withSurvivorV012Ui } from "./survivor-v012-ui.js";

export const APP_VERSION = "0.12.0";

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });
}

async function analyticsRoute(request, env, url) {
  if (url.pathname !== "/api/survivor/analytics" || request.method !== "GET") return null;
  if (!env.DB) return json({ error: "Database is not bound" }, 503);
  const season = Number(url.searchParams.get("season"));
  const week = Number(url.searchParams.get("week"));
  if (!Number.isInteger(season) || !Number.isInteger(week)) return json({ error: "season and week are required" }, 400);

  const bootstrap = new Request(`${url.origin}/api/survivor/entries?season=${encodeURIComponent(season)}`, { method: "GET" });
  await ensureDefaultSurvivorEntries(bootstrap, env);
  try {
    return json({ ok: true, ...(await survivorAnalytics(env.DB, season, week)) });
  } catch (error) {
    return json({ error: "Survivor analytics unavailable", message: error.message }, 400);
  }
}

async function upgradeResponse(request, response) {
  const url = new URL(request.url);
  if (url.pathname === "/api/health") {
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== "object") return response;
    return json({
      ...body,
      version: APP_VERSION,
      survivorAnalyticsV012: true,
      survivorInstantEntrySwitching: true,
      survivorFutureValue: true,
      survivorCalibration: true
    }, response.status, response.headers);
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/app")) {
    if (!response.ok) return response;
    const body = (await response.text()).split("0.11.1").join(APP_VERSION);
    return new Response(withSurvivorV012Ui(body), { status: response.status, headers: response.headers });
  }

  if (request.method === "GET" && url.pathname === "/sw.js") {
    if (!response.ok) return response;
    const body = (await response.text()).split("0.11.1").join(APP_VERSION);
    return new Response(body, { status: response.status, headers: response.headers });
  }

  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const analytics = await analyticsRoute(request, env, url);
    if (analytics) return analytics;
    return upgradeResponse(request, await app.fetch(request, env, ctx));
  },

  scheduled(controller, env, ctx) {
    return app.scheduled(controller, env, ctx);
  }
};
