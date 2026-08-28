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
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
    button { padding: 12px 16px; border: 0; border-radius: 10px; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .55; cursor: wait; }
    pre { white-space: pre-wrap; word-break: break-word; margin-top: 18px; padding: 14px; border-radius: 10px; background: color-mix(in srgb, CanvasText 7%, Canvas); min-height: 48px; }
    .note { font-size: .9rem; opacity: .8; }
  </style>
</head>
<body>
  <main>
    <div class="card">
      <h1>NFL Spread Admin</h1>
      <p>Update upcoming spreads or manually check final scores.</p>
      <p class="note">Final scores are checked automatically every day at 12:15 UTC. The Worker checks D1 first and only calls the 3-day score feed when a stored game is at least 6 hours past kickoff and still lacks a final. If nothing is due, the automatic check uses 0 Odds API credits.</p>
      <p class="note">Opening this page uses no Odds API credits. Spread ingestion normally uses 1 credit. A final-score API call normally uses 2 credits. The manual final-score button uses the same D1-first safeguard, so it also costs 0 credits when no result is due.</p>
      <label for="token">Admin key</label>
      <input id="token" type="password" autocomplete="current-password" placeholder="Enter admin key" />
      <div class="actions">
        <button id="run" type="button">Run spread ingestion</button>
        <button id="results" type="button">Check final scores</button>
      </div>
      <pre id="result">Ready.</pre>
    </div>
  </main>
  <script>
    const tokenInput = document.getElementById('token');
    const runButton = document.getElementById('run');
    const resultsButton = document.getElementById('results');
    const result = document.getElementById('result');
    const buttons = [runButton, resultsButton];
    tokenInput.value = sessionStorage.getItem('nflSpreadAdminToken') || '';

    async function runAdminAction(path, message) {
      const token = tokenInput.value.trim();
      if (!token) {
        result.textContent = 'Enter the admin key first.';
        return;
      }

      sessionStorage.setItem('nflSpreadAdminToken', token);
      buttons.forEach((button) => { button.disabled = true; });
      result.textContent = message;

      try {
        const response = await fetch(path, {
          method: 'POST',
          headers: { 'x-admin-token': token }
        });
        const body = await response.json().catch(() => ({ error: 'Invalid response' }));
        result.textContent = JSON.stringify(body, null, 2);
      } catch (error) {
        result.textContent = JSON.stringify({ error: error.message }, null, 2);
      } finally {
        buttons.forEach((button) => { button.disabled = false; });
      }
    }

    runButton.addEventListener('click', () => runAdminAction('/api/ingest/nfl', 'Running spread ingestion…'));
    resultsButton.addEventListener('click', () => runAdminAction('/api/ingest/nfl/results', 'Checking final scores…'));
  </script>
</body>
</html>`;
}
