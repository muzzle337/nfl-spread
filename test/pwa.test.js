import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker, {
  APP_VERSION as PUBLIC_APP_VERSION,
  hardenServiceWorker,
  stabilizePwaVersionObserver,
  withPwaRecovery
} from "../src/pwa-entry.js";
import {
  APP_VERSION as PWA_BASE_VERSION,
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

test("base service worker stays network-first and avoids API caching", () => {
  const script = serviceWorkerScript();
  assert.match(script, new RegExp(`VERSION = "${PWA_BASE_VERSION.replaceAll(".", "\\.")}"`));
  assert.match(script, /request\.mode === "navigate"/);
  assert.match(script, /fetch\(request, \{ cache: "no-store" \}\)/);
  assert.match(script, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(script, /skipWaiting/);
  assert.match(script, /clients\.claim/);
  assert.match(script, /caches\.delete/);
});

test("hotfix prevents the version observer from watching its own descendant mutations", () => {
  const original = withPwa("<!doctype html><html><head></head><body><div id=\"app\"></div></body></html>");
  assert.match(original, /subtree: true/);
  const stabilized = stabilizePwaVersionObserver(original);
  assert.match(stabilized, /subtree: false/);
  assert.doesNotMatch(stabilized, /new MutationObserver\(mountVersion\)\.observe\(appRoot, \{ childList: true, subtree: true \}\)/);
});

test("self-recovery shell checks API and service-worker versions without looping", () => {
  const page = withPwaRecovery("<!doctype html><html><head></head><body><div id=\"app\"></div></body></html>");
  assert.match(page, /\/api\/health\?client=/);
  assert.match(page, /GET_VERSION/);
  assert.match(page, /service-worker-version-mismatch/);
  assert.match(page, /unresponsive-service-worker/);
  assert.match(page, /recovered/);
  assert.match(page, /data-pwa-reset/);
  assert.match(page, /subtree:false/);
});

test("hardened service worker reports its public version", () => {
  const script = hardenServiceWorker(serviceWorkerScript());
  assert.match(script, /VERSION = "0\.9\.0"/);
  assert.match(script, /GET_VERSION/);
  assert.match(script, /version: "0\.9\.0"/);
});

test("recover route clears only this origin cache and storage then returns to current app", async () => {
  const response = await worker.fetch(new Request("https://example.com/recover?reason=test"), {});
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("clear-site-data"), '"cache", "storage"');
  assert.match(response.headers.get("cache-control"), /no-store/);
  const location = new URL(response.headers.get("location"));
  assert.equal(location.pathname, "/");
  assert.equal(location.searchParams.get("recovered"), "1");
  assert.equal(location.searchParams.get("v"), "0.9.0");
});

test("public worker serves PWA assets and reports synchronized 0.9.0 version", async () => {
  assert.equal(PUBLIC_APP_VERSION, "0.9.0");
  const manifestResponse = await worker.fetch(new Request("https://example.com/manifest.webmanifest"), {});
  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers.get("content-type"), /application\/manifest\+json/);
  assert.equal((await manifestResponse.json()).display, "standalone");
  const swResponse = await worker.fetch(new Request("https://example.com/sw.js"), {});
  assert.equal(swResponse.status, 200);
  assert.match(swResponse.headers.get("content-type"), /application\/javascript/);
  assert.equal(swResponse.headers.get("service-worker-allowed"), "/");
  const sw = await swResponse.text();
  assert.match(sw, /VERSION = "0\.9\.0"/);
  assert.doesNotMatch(sw, /VERSION = "0\.8\.2"/);
  assert.match(sw, /GET_VERSION/);
  const iconResponse = await worker.fetch(new Request("https://example.com/icons/icon-192.png"), {});
  assert.equal(iconResponse.status, 200);
  assert.equal(iconResponse.headers.get("content-type"), "image/png");
  assert.deepEqual(pngSize(new Uint8Array(await iconResponse.arrayBuffer())), { width: 192, height: 192 });
  const healthResponse = await worker.fetch(new Request("https://example.com/api/health"), {});
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).version, PUBLIC_APP_VERSION);
});

test("Cloudflare deploys the PWA wrapper as the worker entrypoint", () => {
  const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(config, /"main"\s*:\s*"src\/pwa-entry\.js"/);
});
