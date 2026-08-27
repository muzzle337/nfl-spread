export function isAdminAuthorized(request, env) {
  const expected = env?.INGEST_ADMIN_TOKEN;
  if (!expected) return { ok: false, status: 503, error: "Admin ingest token is not configured" };

  const provided = request.headers.get("x-admin-token");
  if (!provided || provided !== expected) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}

export function adminIngestPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>NFL Spread Admin</title>
  <style>
    :root { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color-scheme: light dark; }
    body { margin: 0; padding: 24px; background: Canvas; color: CanvasText; }
    main { max-width: 640px; margin: 40px auto; }
    .card { border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); border-radius: 16px; padding: 20px; }
    h1 { margin: 0 0 8px; font-size: 1.5rem; }
    p { line-height: 1.5; }
    label { display: block; font-weight: 600; margin-top: 18px; }
    input { width: 100%; box-sizing: border-box; margin-top: 8px; padding: 12px; border-radius: 10px; border: 1px solid color-mix(in srgb, CanvasText 25%, transparent); }
    button { margin-top: 16px; padding: 12px 16px; border: 0; border-radius: 10px; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .55; cursor: wait; }
    pre { white-space: pre-wrap; word-break: break-word; margin-top: 18px; padding: 14px; border-radius: 10px; background: color-mix(in srgb, CanvasText 7%, Canvas); min-height: 48px; }
    .note { font-size: .9rem; opacity: .8; }
  </style>
</head>
<body>
  <main>
    <div class="card">
      <h1>NFL Spread Ingestion</h1>
      <p>Imports the earliest upcoming NFL week and stores only new or changed bookmaker spreads.</p>
      <p class="note">Opening this page uses no Odds API credits. Running ingestion normally uses one credit.</p>
      <label for="token">Admin key</label>
      <input id="token" type="password" autocomplete="current-password" placeholder="Enter admin key" />
      <button id="run" type="button">Run ingestion</button>
      <pre id="result">Ready.</pre>
    </div>
  </main>
  <script>
    const tokenInput = document.getElementById('token');
    const runButton = document.getElementById('run');
    const result = document.getElementById('result');
    tokenInput.value = sessionStorage.getItem('nflSpreadAdminToken') || '';

    runButton.addEventListener('click', async () => {
      const token = tokenInput.value.trim();
      if (!token) {
        result.textContent = 'Enter the admin key first.';
        return;
      }

      sessionStorage.setItem('nflSpreadAdminToken', token);
      runButton.disabled = true;
      result.textContent = 'Running ingestion…';

      try {
        const response = await fetch('/api/ingest/nfl', {
          method: 'POST',
          headers: { 'x-admin-token': token }
        });
        const body = await response.json().catch(() => ({ error: 'Invalid response' }));
        result.textContent = JSON.stringify(body, null, 2);
      } catch (error) {
        result.textContent = JSON.stringify({ error: error.message }, null, 2);
      } finally {
        runButton.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}
