import app from "./v010-entry.js";
import { withSurvivorV0111Ui } from "./survivor-v0111-ui.js";

export const APP_VERSION = "0.11.1";
export const DEFAULT_SURVIVOR_ENTRIES = Object.freeze([
  "Muzzle 1",
  "Muzzle 2",
  "Muzzle 3",
  "Muzzle 4",
  "Muzzle 5",
  "Muzzle 6"
]);

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

export async function ensureDefaultSurvivorEntries(request, env) {
  if (!env?.DB || request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname !== "/api/survivor/entries") return;
  const season = Number(url.searchParams.get("season"));
  if (!Number.isInteger(season)) return;

  try {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO survivor_entries(season, name, active, updated_at)
      VALUES
        (?, ?, 1, CURRENT_TIMESTAMP),
        (?, ?, 1, CURRENT_TIMESTAMP),
        (?, ?, 1, CURRENT_TIMESTAMP),
        (?, ?, 1, CURRENT_TIMESTAMP),
        (?, ?, 1, CURRENT_TIMESTAMP),
        (?, ?, 1, CURRENT_TIMESTAMP)
    `).bind(
      season, DEFAULT_SURVIVOR_ENTRIES[0],
      season, DEFAULT_SURVIVOR_ENTRIES[1],
      season, DEFAULT_SURVIVOR_ENTRIES[2],
      season, DEFAULT_SURVIVOR_ENTRIES[3],
      season, DEFAULT_SURVIVOR_ENTRIES[4],
      season, DEFAULT_SURVIVOR_ENTRIES[5]
    ).run();
  } catch (error) {
    console.error("Unable to ensure default Survivor entries", error);
  }
}

async function withV011Version(request, response) {
  const url = new URL(request.url);

  if (url.pathname === "/api/health") {
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== "object") return response;
    return json({
      ...body,
      version: APP_VERSION,
      marketDisplayV011: true,
      survivorUxV011: true,
      survivorSixEntries: true
    }, response.status, response.headers);
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/app")) {
    if (!response.ok) return response;
    const body = (await response.text())
      .split("0.10.2").join(APP_VERSION)
      .split("0.11.0").join(APP_VERSION);
    return new Response(withSurvivorV0111Ui(body), { status: response.status, headers: response.headers });
  }

  if (request.method === "GET" && url.pathname === "/sw.js") {
    if (!response.ok) return response;
    const body = (await response.text())
      .split("0.10.2").join(APP_VERSION)
      .split("0.11.0").join(APP_VERSION);
    return new Response(body, { status: response.status, headers: response.headers });
  }

  return response;
}

export default {
  async fetch(request, env, ctx) {
    await ensureDefaultSurvivorEntries(request, env);
    return withV011Version(request, await app.fetch(request, env, ctx));
  },

  scheduled(controller, env, ctx) {
    return app.scheduled(controller, env, ctx);
  }
};
