import app from "./index.js";
import { APP_VERSION, iconPng, manifestData, serviceWorkerScript, withPwa } from "./pwa.js";

function textResponse(body, contentType, headers = {}) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      ...headers
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
  return new Response(withPwa(body), {
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
      return textResponse(serviceWorkerScript(), "application/javascript; charset=utf-8", {
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
