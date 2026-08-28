import app from "./index.js";
import { lineMovementForGame } from "./line-movement.js";
import { withLineMovementUi } from "./line-movement-ui.js";
import { APP_VERSION as PWA_BASE_VERSION, iconPng, manifestData, serviceWorkerScript, withPwa } from "./pwa.js";

export const APP_VERSION = "0.8.1";

function textResponse(body, contentType, headers = {}) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      ...headers
    }
  });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}

function imageResponse(bytes) {
  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400"
    }
  });
}

function publicPwaVersion(value) {
  return String(value).split(PWA_BASE_VERSION).join(APP_VERSION);
}

export function stabilizePwaVersionObserver(value) {
  return String(value).replace(
    "new MutationObserver(mountVersion).observe(appRoot, { childList: true, subtree: true })",
    "new MutationObserver(mountVersion).observe(appRoot, { childList: true, subtree: false })"
  );
}

async function withPublicVersion(response) {
  const body = await response.json().catch(() => null);
  if (!body || typeof body !== "object") return response;
  return new Response(JSON.stringify({ ...body, version: APP_VERSION }), {
    status: response.status,
    headers: response.headers
  });
}

async function withPwaShell(response) {
  if (!response.ok) return response;
  const body = await response.text();
  const pwa = stabilizePwaVersionObserver(publicPwaVersion(withPwa(body)));
  return new Response(withLineMovementUi(pwa), {
    status: response.status,
    headers: response.headers
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/manifest.webmanifest") {
      return textResponse(JSON.stringify(manifestData()), "application/manifest+json; charset=utf-8", {
        "cache-control": "no-cache"
      });
    }

    if (request.method === "GET" && url.pathname === "/sw.js") {
      return textResponse(publicPwaVersion(serviceWorkerScript()), "application/javascript; charset=utf-8", {
        "cache-control": "no-cache, no-store, must-revalidate",
        "service-worker-allowed": "/"
      });
    }

    if (request.method === "GET" && url.pathname === "/icons/icon-192.png") {
      return imageResponse(iconPng(192));
    }

    if (request.method === "GET" && url.pathname === "/icons/icon-512.png") {
      return imageResponse(iconPng(512));
    }

    if (request.method === "GET" && url.pathname === "/icons/apple-touch-icon.png") {
      return imageResponse(iconPng(180));
    }

    if (request.method === "GET" && url.pathname === "/api/lines/movement") {
      if (!env.DB) return jsonResponse({ error: "Database is not bound" }, 503);
      const gameId = url.searchParams.get("game");
      if (!gameId) return jsonResponse({ error: "game is required" }, 400);
      try {
        const movement = await lineMovementForGame(env.DB, gameId);
        if (!movement) return jsonResponse({ error: "Game not found" }, 404);
        return jsonResponse({ ok: true, movement });
      } catch (error) {
        return jsonResponse({ error: "Line movement unavailable", message: error.message }, 400);
      }
    }

    const response = await app.fetch(request, env, ctx);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/app")) {
      return withPwaShell(response);
    }

    if (url.pathname === "/api/health") {
      return withPublicVersion(response);
    }

    return response;
  },

  scheduled(controller, env, ctx) {
    return app.scheduled(controller, env, ctx);
  }
};
