import app from "./v013-entry.js";
import { contextForWeek } from "./context.js";
import { buildOpportunityBoard } from "./context-opportunity.js";
import { ensureContextSchema } from "./context-schema.js";
import { withContextOpportunityUi } from "./context-opportunity-ui.js";

export const APP_VERSION = "0.14.0";

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

function replaceKnownAppVersions(body) {
  return body
    .split("0.12.0").join(APP_VERSION)
    .split("0.13.0").join(APP_VERSION)
    .split("0.13.1").join(APP_VERSION)
    .split("0.13.2").join(APP_VERSION)
    .split("0.13.3").join(APP_VERSION);
}

async function opportunityRoute(request, env, url) {
  if (url.pathname !== "/api/context/opportunities") return null;
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!env.DB) return json({ error: "Database is not bound" }, 503);
  const season = Number(url.searchParams.get("season"));
  const week = Number(url.searchParams.get("week"));
  if (!Number.isInteger(season) || !Number.isInteger(week) || week < 1) return json({ error: "season and week are required" }, 400);
  try {
    await ensureContextSchema(env.DB);
    const context = await contextForWeek(env.DB, season, week);
    return json({
      ok: true,
      season,
      week,
      games: context.games,
      opportunities: buildOpportunityBoard(context.games),
      lastSync: context.lastSync,
      principle: context.principle,
      scoringPrinciple: "Opportunity score counts transparent context signals. It is not a betting probability and does not modify spread or Survivor outputs."
    });
  } catch (error) {
    return json({ error: "Context opportunities unavailable", message: error.message }, 400);
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
      contextUiTemporarilyDisabled: false,
      contextNativeSafeRenderer: true,
      contextOpportunityBoard: true,
      contextOpportunityAffectsPredictions: false,
      contextOpportunitySignals: ["weather", "rest", "point-differential", "offensive-epa", "defensive-epa", "success-rate"]
    }, response.status, response.headers);
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/app")) {
    if (!response.ok) return response;
    const body = replaceKnownAppVersions(await response.text());
    return new Response(withContextOpportunityUi(body), { status: response.status, headers: response.headers });
  }

  if (request.method === "GET" && url.pathname === "/sw.js") {
    if (!response.ok) return response;
    return new Response(replaceKnownAppVersions(await response.text()), { status: response.status, headers: response.headers });
  }

  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const opportunity = await opportunityRoute(request, env, url);
    if (opportunity) return opportunity;
    return upgradeResponse(request, await app.fetch(request, env, ctx));
  },

  scheduled(controller, env, ctx) {
    return app.scheduled(controller, env, ctx);
  }
};
