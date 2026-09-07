import app from "./v010-entry.js";

const APP_VERSION = "0.11.0";

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

async function withV011Version(request, response) {
  const url = new URL(request.url);

  if (url.pathname === "/api/health") {
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== "object") return response;
    return json({ ...body, version: APP_VERSION, marketDisplayV011: true, survivorUxV011: true }, response.status, response.headers);
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/app" || url.pathname === "/sw.js")) {
    if (!response.ok) return response;
    const body = (await response.text()).split("0.10.2").join(APP_VERSION);
    return new Response(body, { status: response.status, headers: response.headers });
  }

  return response;
}

export default {
  async fetch(request, env, ctx) {
    return withV011Version(request, await app.fetch(request, env, ctx));
  },

  scheduled(controller, env, ctx) {
    return app.scheduled(controller, env, ctx);
  }
};
