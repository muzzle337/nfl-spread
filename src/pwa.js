export const APP_VERSION = "0.7.0";

const ICONS = {
  192: "iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAIAAADdvvtQAAAEB0lEQVR42u3dMU4bQRSAYXu0DQUNtJEiRRQ5BKl8AjpqGg7AOTgATep0nIAKDpECRYqUlhukSGHJssB2jJnZnZn3/ZUjDNjrL2/GNrbnR8cnM+nQkkMggASQABJAEkACSAAJIAkgASSABJAEkAASQOqmoZ6Lsrh7cXvs38P1aQ0XYz7tXyRC0zqmaQBx042kUQHtdvN0c0bA/p3fPtcgaTxAG/VAUw7TOIbGAPSWDjejSSrNqDigV3rQGZ9RUUMFAaETgVGip9deHfNC93yLTKD1y4pOVaMo+xxK9IQaRdnnUKKHoVoA0RPQUKKHobr2QPQ0dNesFkArzvQ0ZCjLEEoZ9ai5Pn7bpRK0FWchS7kI0xNzIUtZ9CjsQpbycla0hcyrMjQRILsfOyETSJYwtQjI+mUVM4FkCRNACgfIBsg2yASSJUwACSABJAEkgASQAJIAEkACSABJAAkgASSAJIAEkAASQBJAAkgACSABJAGkMRv6vnp/fv087Bs/ffla7kcB1KGYQj/n7Y/qzNNAzLQXuHVPAzeVXJFGJQ3oVHW9mmM0oINR/4Ai0GmUUaLHFe8ZUFg9rVz95PAx1OEeCJ1WtkSeC1N3gIyfhg5LcpgYsoQJIOOnzUOUHJpll/fD5f2w4/S2MwQ3ZAkTQAJIACliQ7QrvHvzu/7Vjae3nWHVj4u/JpAEkCxhJdq2xCzXo+VXN57edgYTSAJIAKnF5kfHJ+/9nnKfG+/J1H0q8aeJ57fPyxMP16cNT6C+34egy0NkCVNfgAyhtg5OcpjosYRpsoaa/7e5U1b/SE4OHD09L2HBDdV/9ZOD6Ip3uAcKviXyBlMYRRm3Q6OHuD9G3mRzmsPduiRv81vXDVC/J280HsKTjzoICqjcjedRzY15LkwACSABJIAkgASQABJAEkACSAAJIAmg2ezqcXH1uHDDAySABJAAkgASQAJIAEkAabT6fF3Yfx9r3nGG798e9vwtv+8Pf6XY54tOXttvAskEes8UWc6e/cdMhCliAgkgxQG0+jyO1Sd0qOkO/qQVE0iWMAGkcIBsg2yAloX71OYsjwDJEqapAVnFrF8mkOpYwgyhpsfPZIAOnnuqqo/cjinX7zaEou1+8u+BGAq1eGUDZCGLuXjlnEAWsoCLV6m78QwFWbwyA1rnzFD9enJtPHJOIIai6cm/hDEUSk+RPRBDcfTMZrP50fFJiQu9uHtZ/+fTzZkbcvItc4kHXEo9mfrqshpFXeopOIGMou7pjATorSGMRqMzK/88wRiAtjEiqZyb2VhPMY0HaJshmDKiGVnP2ID2lKRc9126BURS625qAQRTi2gqBaQW86oMASSABJAAkgASQAJIAEkACSABJIAkgASQquofQfqhhbbRWCoAAAAASUVORK5CYII=",
  512: "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",
  180: "iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAIAAACyr5FlAAAD5ElEQVR42u3dPU4bQRiA4WW0DQUNtJEiRRQ5BKl8AjpqGg7AOTgATep0nIAKDpECIUVKyw1SpLDkOGTXEO/M7vw8b+UIB7y7T74ZbEMODo+OO2mo4BQIDsEhOASH4BAcgkNwCA7BIcEhOASH4NAS9Ys/gtXti8sw1v3VyYJf/WCRN/sAUQSUWXEwUZaSmXDsYPF4fep6j3V287QgkeQ4BlkAEQtKUiJpcfwrA4voRNL5SIXjFQsmUitJQSSQUWivzmqKzX78ybH9KLGYeYTEnR+BjJpGSNz5EcjgIzkOMurzEcjgIyEOMmr1ERI9MmXyLe6SODY8ycjQx8ThEaLIULZNuUYhLlXVtLiE6STJqHVx8R5SxcZht9HCzmPq5LCmVLzzsKwoKg5b0Ua2pSaH4BAcWhKHDUc72w6TQ3AIDsEhOASH4BAcgkNwCA4JDsEhOASH4BAcgkNwCA7BIcEhOASH4NCs9bUe2M/n7++524dPn1N/EjhyR5Dor+/+JKWj6ZtlMdsjLJdIT8PMD7sgKz0WxkmpOGpiURyRQIYDLGxyVM+iiBESyHDIxeBoUEa2Bx6cIIdfAI7GZWR4ErzwpuxxGBsZnorgdPBhWfmri7v+4q7fcXvsDpYVKQ8c1pRsT4vJITj0/9W/z9qxl9z+0ODtsTus+3b+y+SQZUVqbVkZHP7rNWL9ocHbY3cwOaQ8cNT6E0EVnBaTQw3vOd7ciAzeHruDZcXK4oTktKzwkeGpsOdQCTgMj9xOQnBqHH4xy0qzPjI88OA0OeSx+pxPVgtvEsv5X0Jw4hxgYZOj+hHil7cgUvY47Ms9raVY8QvjjJMK90zFvyo7dgH8klo40l6wxp+x9cKb4BAcgkNwCA7BITgEh+AQHBIcguNPlw+ry4eVKw2H4BAcgkNwCA7BITjUcJW8+/zNp7nG7vD1y/07v8SPuz3fif7xvNQf1DM5VPvk2DEA1jPj/ROivgFgcggO5Yzj/upkfePs5snpK6LNldpcO5NDlhXBoTJw2Ha0sOHoWvgvNaY/w2FyTIWpnMfGrDj2mFFasP2ulw2pEuCwLa14KxpzcvBR2W4jAg47j1p3G3Emh8WlygUl/oaUj2oWlGg4tnnykY+M6Yt+nMnBR30yYi4rfFQmI/Keg4+aZHTRnyHloxoZXdcdHB4dR3+4q9uX7T8+Xp+6hDN8YxL9aackr628epRGSIkyUk2OsRFiikQ30aV8njotjkEfiMRi0SV+BSM5jh1EQNkPxAwsZsXxJhHtvaWrBAclRZhYGAco2YLIC4eyzXtIBYfgEByCQ3AIDsEhOASH4JDgEByCQyn7DcdXk4vX1CRLAAAAAElFTkSuQmCC"
};

function decodeBase64(value) {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function iconPng(size) {
  const numeric = Number(size);
  const value = ICONS[numeric];
  if (!value) return null;
  return decodeBase64(value);
}

export function manifestData() {
  return {
    id: "/",
    name: "NFL Spread Tool",
    short_name: "NFL Spread",
    description: "Current-season NFL spread market and classification tool.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#090d12",
    theme_color: "#090d12",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ]
  };
}

export function serviceWorkerScript() {
  return `const VERSION = "${APP_VERSION}";
const CACHE_NAME = "nfl-spread-shell-" + VERSION;
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("nfl-spread-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put("/", response.clone());
        }
        return response;
      } catch {
        return (await caches.match("/")) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/icons/")) {
    event.respondWith((async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })());
  }
});`;
}

export function withPwa(html) {
  if (typeof html !== "string") return html;

  const head = `
  <link rel="manifest" href="/manifest.webmanifest?v=${APP_VERSION}" />
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png?v=${APP_VERSION}" />
  <meta name="application-name" content="NFL Spread Tool" />
  <meta name="apple-mobile-web-app-title" content="NFL Spread" />
  <meta name="mobile-web-app-capable" content="yes" />
  <style>
    .pwa-version-info { margin: 18px 2px 2px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.06); text-align: center; color: #6f7f90; font-size: 10px; line-height: 1.45; }
    .pwa-version-info strong { color: #9eb0c2; font-weight: 750; }
    .pwa-version-warning { color: #f1c84b; }
  </style>`;

  const script = `
  <script>
    (function () {
      var APP_VERSION = '${APP_VERSION}';
      var apiVersion = null;
      var healthFailed = false;
      var appRoot = document.getElementById('app');

      function versionMarkup() {
        var api = apiVersion || (healthFailed ? 'unavailable' : 'checking…');
        var mismatch = apiVersion && apiVersion !== APP_VERSION;
        return '<div id="pwaVersionInfo" class="pwa-version-info' + (mismatch ? ' pwa-version-warning' : '') + '">' +
          '<strong>NFL Spread Tool</strong> · App v' + APP_VERSION + ' · API v' + api +
          (mismatch ? '<br>Update pending — reopen the app if this remains mismatched.' : '') +
        '</div>';
      }

      function mountVersion() {
        var toolsIntro = document.querySelector('.tools-intro');
        if (!toolsIntro) return;
        var main = toolsIntro.closest('main');
        if (!main) return;
        var existing = document.getElementById('pwaVersionInfo');
        if (existing) existing.outerHTML = versionMarkup();
        else main.insertAdjacentHTML('beforeend', versionMarkup());
      }

      if (appRoot) new MutationObserver(mountVersion).observe(appRoot, { childList: true, subtree: true });

      fetch('/api/health', { cache: 'no-store', headers: { accept: 'application/json' } })
        .then(function (response) { return response.ok ? response.json() : Promise.reject(new Error('health')); })
        .then(function (body) { apiVersion = body.version || 'unknown'; mountVersion(); })
        .catch(function () { healthFailed = true; mountVersion(); });

      if ('serviceWorker' in navigator) {
        var reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (reloading) return;
          reloading = true;
          window.location.reload();
        });
        navigator.serviceWorker.register('/sw.js?v=' + APP_VERSION, { scope: '/', updateViaCache: 'none' })
          .then(function (registration) { registration.update().catch(function () {}); })
          .catch(function () {});
      }
    })();
  </script>`;

  return html.replace("</head>", `${head}\n</head>`).replace("</body>", `${script}\n</body>`);
}
