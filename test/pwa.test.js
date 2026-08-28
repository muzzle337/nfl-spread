import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/pwa-entry.js";
import {
  APP_VERSION,
  iconPng,
  manifestData,
  serviceWorkerScript,
  withPwa
} from "../src/pwa.js";

function pngSize(bytes) {
  assert.equal(bytes[0], 0x89);
  assert.equal(bytes[1], 0x50);
  assert.equal(bytes[2], 0x4e);
  assert.equal(bytes[3], 0x47);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

test("manifest makes the spread tool installable as a standalone app", () => {
  const manifest = manifestData();
  assert.equal(manifest.name, "NFL Spread Tool");
  assert.equal(manifest.short_name, "NFL Spread");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/?source=pwa");
  assert.equal(manifest.scope, "/");
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
  assert.ok(manifest.icons.every((icon) => icon.purpose.includes("maskable")));
});

test("PWA icons are real PNGs at the declared dimensions", () => {
  assert.deepEqual(pngSize(iconPng(192)), { width: 192, height: 192 });
  assert.deepEqual(pngSize(iconPng(512)), { width: 512, height: 512 });
  assert.deepEqual(pngSize(iconPng(180)), { width: 180, height: 180 });
});

test("service worker is versioned, avoids API caching, and uses network-first navigation", () => {
  const script = serviceWorkerScript();
  assert.match(script, new RegExp(`VERSION = "${APP_VERSION.replaceAll(".", "\\.")}"`));
  assert.match(script, /request\.mode === "navigate"/);
  assert.match(script, /fetch\(request, \{ cache: "no-store" \}\)/);
  assert.match(script, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(script, /skipWaiting/);
  assert.match(script, /clients\.claim/);
  assert.match(script, /caches\.delete/);
});

test("PWA shell exposes manifest, apple icon, service worker, and app/API version UI", () => {
  const page = withPwa("<!doctype html><html><head></head><body><div id=\"app\"></div></body></html>");
  assert.match(page, /manifest\.webmanifest/);
  assert.match(page, /apple-touch-icon/);
  assert.match(page, /serviceWorker\.register/);
  assert.match(page, /App v/);
  assert.match(page, /API v/);
  assert.match(page, new RegExp(APP_VERSION.replaceAll(".", "\\.")));
  assert.match(page, /\/api\/health/);
});

test("public worker serves PWA assets and reports the synchronized 0.7 app version", async () => {
  const manifestResponse = await worker.fetch(new Request("https://example.com/manifest.webmanifest"), {});
  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers.get("content-type"), /application\/manifest\+json/);
  assert.equal((await manifestResponse.json()).display, "standalone");

  const swResponse = await worker.fetch(new Request("https://example.com/sw.js"), {});
  assert.equal(swResponse.status, 200);
  assert.match(swResponse.headers.get("content-type"), /application\/javascript/);
  assert.equal(swResponse.headers.get("service-worker-allowed"), "/");

  const iconResponse = await worker.fetch(new Request("https://example.com/icons/icon-192.png"), {});
  assert.equal(iconResponse.status, 200);
  assert.equal(iconResponse.headers.get("content-type"), "image/png");
  assert.deepEqual(pngSize(new Uint8Array(await iconResponse.arrayBuffer())), { width: 192, height: 192 });

  const healthResponse = await worker.fetch(new Request("https://example.com/api/health"), {});
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).version, APP_VERSION);
});

test("Cloudflare deploys the PWA wrapper as the worker entrypoint", () => {
  const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(config, /"main"\s*:\s*"src\/pwa-entry\.js"/);
});
