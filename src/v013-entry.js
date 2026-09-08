import app from "./v012-entry.js";
import { isAdminSessionAuthorized } from "./admin-session.js";
import { contextForWeek, syncContext } from "./context.js";
import { ensureContextSchema } from "./context-schema.js";
import { withContextUi } from "./context-ui.js";

export const APP_VERSION = "0.13.1";

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

export function contextHealth(body = {}) {
  return {
    ...body,
    version: APP_VERSION,
    contextIntelligence: true,
    contextSources: ["nfldata", "nflverse", "open-meteo"],
    contextAffectsPredictions: false,
    contextDiagnostics: true,
    contextProvenance: true
  };
}

async function contextRoute(request, env, url) {
  if (!url.pathname.startsWith("/api/context/")) return null;
  if (!env.DB) return json({ error: "Database is not bound" }, 503);
  const season = Number(url.searchParams.get("season"));
  const week = Number(url.searchParams.get("week"));
  if (!Number.isInteger(season) || !Number.isInteger(week) || week < 1) return json({ error: "season and week are required" }, 400);

  if (url.pathname === "/api/context/nfl" && request.method === "GET") {
    try {
      await ensureContextSchema(env.DB);
      return json({ ok: true, ...(await contextForWeek(env.DB, season, week)) });
    } catch (error) {
      return json({ error: "Context unavailable", message: error.message }, 400);
    }
  }

  if (url.pathname === "/api/context/sync" && request.method === "POST") {
    const auth = await isAdminSessionAuthorized(request, env);
    if (!auth.ok) return json({ error: auth.error }, auth.status);
    try {
      return json({ ok: true, ...(await syncContext(env.DB, season, week)) });
    } catch (error) {
      return json({ error: "Context sync failed", message: error.message }, 502);
    }
  }

  return json({ error: "Method not allowed" }, 405);
}

async function upgradeResponse(request, response) {
  const url = new URL(request.url);
  if (url.pathname === "/api/health") {
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== "object") return response;
    return json(contextHealth(body), response.status, response.headers);
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/app")) {
    if (!response.ok) return response;
    const body = (await response.text()).split("0.12.0").join(APP_VERSION).split("0.13.0").join(APP_VERSION);
    return new Response(withContextUi(body), { status: response.status, headers: response.headers });
  }

  if (request.method === "GET" && url.pathname === "/sw.js") {
    if (!response.ok) return response;
    const body = (await response.text()).split("0.12.0").join(APP_VERSION).split("0.13.0").join(APP_VERSION);
    return new Response(body, { status: response.status, headers: response.headers });
  }

  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const context = await contextRoute(request, env, url);
    if (context) return context;
    return upgradeResponse(request, await app.fetch(request, env, ctx));
  },

  scheduled(controller, env, ctx) {
    return app.scheduled(controller, env, ctx);
  }
};
