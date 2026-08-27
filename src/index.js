import { classifyGame, focusGrade, settleAgainstSpread } from "./engine.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      let database = "unbound";
      if (env.DB) {
        try {
          await env.DB.prepare("SELECT 1").first();
          database = "ok";
        } catch {
          database = "error";
        }
      }
      return json({ ok: true, service: "nfl-spread-api", version: "0.1.0", database });
    }

    if (url.pathname === "/api/engine/demo") {
      return json({
        classification: classifyGame(-3.5, 3.5),
        settlement: settleAgainstSpread({ awaySpread: -3.5, homeSpread: 3.5, awayScore: 24, homeScore: 17 }),
        grade: focusGrade(64)
      });
    }

    return json({ error: "Not found" }, 404);
  }
};
