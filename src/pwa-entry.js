import app from "./index.js";
import { lineMovementForGame } from "./line-movement.js";
import { withLineMovementUi } from "./line-movement-ui.js";
import { APP_VERSION as PWA_BASE_VERSION, iconPng, manifestData, serviceWorkerScript, withPwa } from "./pwa.js";

export const APP_VERSION = "0.8.2";

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

export function hardenServiceWorker(value) {
  return `${publicPwaVersion(value)}\n\nself.addEventListener("message", (event) => {\n  if (!event.data || event.data.type !== "GET_VERSION") return;\n  const payload = { type: "VERSION", version: "${APP_VERSION}" };\n  if (event.ports && event.ports[0]) event.ports[0].postMessage(payload);\n  else if (event.source && event.source.postMessage) event.source.postMessage(payload);\n});`;
}

export function withPwaRecovery(html) {
  if (typeof html !== "string") return html;
  const recovery = `
  <style>
    .pwa-reset-button { width:100%; margin-top:9px; border:1px solid #233041; background:#0e141c; color:#9eb0c2; border-radius:11px; padding:10px 12px; font:750 10px/1.2 system-ui,sans-serif; cursor:pointer; }
  </style>
  <script>
    (function () {
      var APP_VERSION = '${APP_VERSION}';
      var query = new URLSearchParams(window.location.search);
      var justRecovered = query.get('recovered') === '1';
      var recovering = false;

      if (justRecovered) {
        try { sessionStorage.removeItem('nflSpreadRecoveryAttempt'); } catch (_) {}
        query.delete('recovered');
        query.delete('v');
        var clean = window.location.pathname + (query.toString() ? '?' + query.toString() : '') + window.location.hash;
        try { history.replaceState(null, '', clean); } catch (_) {}
      }

      function recover(reason) {
        if (recovering || justRecovered) return;
        try {
          if (sessionStorage.getItem('nflSpreadRecoveryAttempt') === APP_VERSION) return;
          sessionStorage.setItem('nflSpreadRecoveryAttempt', APP_VERSION);
        } catch (_) {}
        recovering = true;
        window.location.replace('/recover?reason=' + encodeURIComponent(reason || 'automatic'));
      }

      function mountResetButton() {
        var toolsIntro = document.querySelector('.tools-intro');
        if (!toolsIntro || document.querySelector('[data-pwa-reset]')) return;
        toolsIntro.insertAdjacentHTML('afterend', '<button type="button" class="pwa-reset-button" data-pwa-reset="1">Reset this app cache</button>');
      }

      document.addEventListener('click', function (event) {
        var target = event.target && event.target.closest ? event.target.closest('[data-pwa-reset]') : null;
        if (target) window.location.href = '/recover?reason=manual';
      });

      var root = document.getElementById('app');
      if (root) new MutationObserver(mountResetButton).observe(root, { childList:true, subtree:false });
      mountResetButton();

      fetch('/api/health?client=' + encodeURIComponent(APP_VERSION), { cache:'no-store', headers:{ accept:'application/json' } })
        .then(function (response) { return response.ok ? response.json() : null; })
        .then(function (body) {
          if (body && body.version && body.version !== APP_VERSION) recover('version-mismatch');
        })
        .catch(function () {});

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller && typeof MessageChannel !== 'undefined') {
        setTimeout(function () {
          if (recovering || justRecovered || !navigator.serviceWorker.controller) return;
          var channel = new MessageChannel();
          var finished = false;
          var timer = setTimeout(function () {
            if (!finished) recover('unresponsive-service-worker');
          }, 1800);
          channel.port1.onmessage = function (event) {
            finished = true;
            clearTimeout(timer);
            var version = event.data && event.data.version;
            if (version !== APP_VERSION) recover('service-worker-version-mismatch');
          };
          try {
            navigator.serviceWorker.controller.postMessage({ type:'GET_VERSION' }, [channel.port2]);
          } catch (_) {
            clearTimeout(timer);
            recover('service-worker-check-failed');
          }
        }, 600);
      }
    })();
  </script>`;
  return html.replace("</body>", `${recovery}\n</body>`);
}

function recoveryResponse(request) {
  const target = new URL(request.url);
  target.pathname = "/";
  target.search = "";
  target.searchParams.set("recovered", "1");
  target.searchParams.set("v", APP_VERSION);
  return new Response(null, {
    status: 302,
    headers: {
      location: target.toString(),
      "clear-site-data": '"cache", "storage"',
      "cache-control": "no-store, no-cache, must-revalidate",
      pragma: "no-cache",
      expires: "0"
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
  const pwa = stabilizePwaVersionObserver(publicPwaVersion(withPwa(body)));
  return new Response(withLineMovementUi(withPwaRecovery(pwa)), {
    status: response.status,
    headers: response.headers
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/recover") {
      return recoveryResponse(request);
    }

    if (request.method === "GET" && url.pathname === "/manifest.webmanifest") {
      return textResponse(JSON.stringify(manifestData()), "application/manifest+json; charset=utf-8", {
        "cache-control": "no-cache"
      });
    }

    if (request.method === "GET" && url.pathname === "/sw.js") {
      return textResponse(hardenServiceWorker(serviceWorkerScript()), "application/javascript; charset=utf-8", {
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
