import { ensureHistorySchema } from "./history-schema.js";

const NFLVERSE_SCHEDULES_CSV = "https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(value) {
  const n = finite(value);
  return n === null ? null : Math.trunc(n);
}

function clean(value) {
  const s = String(value ?? "").trim();
  return s || null;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(field); field = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
}

export function isPrimeTimeGame(row) {
  const time = clean(row.gametime || row.game_time || row.start_time);
  if (!time) return false;
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const minutes = hour * 60 + minute;
  return minutes >= 19 * 60;
}

export function normalizeHistoricalGame(row) {
  return {
    gameId: clean(row.game_id || row.id),
    season: intOrNull(row.season),
    week: intOrNull(row.week),
    gameType: String(row.game_type || row.season_type || "REG").toUpperCase(),
    gameday: clean(row.gameday || row.game_date),
    weekday: clean(row.weekday),
    gametime: clean(row.gametime),
    awayTeam: clean(row.away_team),
    homeTeam: clean(row.home_team),
    awayScore: intOrNull(row.away_score),
    homeScore: intOrNull(row.home_score),
    result: finite(row.result),
    spreadLine: finite(row.spread_line),
    totalLine: finite(row.total_line),
    location: clean(row.location),
    stadium: clean(row.stadium || row.game_stadium),
    roof: clean(row.roof),
    surface: clean(row.surface),
    tempF: finite(row.temp),
    windMph: finite(row.wind),
    awayRest: intOrNull(row.away_rest),
    homeRest: intOrNull(row.home_rest),
    awayCoach: clean(row.away_coach),
    homeCoach: clean(row.home_coach),
    divGame: intOrNull(row.div_game) ?? 0,
    primeTime: isPrimeTimeGame(row) ? 1 : 0
  };
}

async function fetchScheduleRows(fetchImpl = fetch) {
  const response = await fetchImpl(NFLVERSE_SCHEDULES_CSV, { headers: { accept: "text/csv" } });
  if (!response.ok) throw new Error(`nflverse schedules returned ${response.status}`);
  return parseCsv(await response.text());
}

function validHistoricalGame(g, startSeason, endSeason) {
  return g.gameId && g.season >= startSeason && g.season <= endSeason && g.gameType === "REG" &&
    g.awayTeam && g.homeTeam && g.awayScore !== null && g.homeScore !== null;
}

function upsertStatement(db, g) {
  return db.prepare(`
    INSERT INTO historical_games (
      game_id, season, week, game_type, gameday, weekday, gametime,
      away_team, home_team, away_score, home_score, result, spread_line, total_line,
      location, stadium, roof, surface, temp_f, wind_mph,
      away_rest, home_rest, away_coach, home_coach, div_game, prime_time, source, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nflverse', CURRENT_TIMESTAMP)
    ON CONFLICT(game_id) DO UPDATE SET
      season=excluded.season, week=excluded.week, game_type=excluded.game_type,
      gameday=excluded.gameday, weekday=excluded.weekday, gametime=excluded.gametime,
      away_team=excluded.away_team, home_team=excluded.home_team,
      away_score=excluded.away_score, home_score=excluded.home_score,
      result=excluded.result, spread_line=excluded.spread_line, total_line=excluded.total_line,
      location=excluded.location, stadium=excluded.stadium, roof=excluded.roof, surface=excluded.surface,
      temp_f=excluded.temp_f, wind_mph=excluded.wind_mph,
      away_rest=excluded.away_rest, home_rest=excluded.home_rest,
      away_coach=excluded.away_coach, home_coach=excluded.home_coach,
      div_game=excluded.div_game, prime_time=excluded.prime_time,
      imported_at=CURRENT_TIMESTAMP
  `).bind(
    g.gameId, g.season, g.week, g.gameType, g.gameday, g.weekday, g.gametime,
    g.awayTeam, g.homeTeam, g.awayScore, g.homeScore, g.result, g.spreadLine, g.totalLine,
    g.location, g.stadium, g.roof, g.surface, g.tempF, g.windMph,
    g.awayRest, g.homeRest, g.awayCoach, g.homeCoach, g.divGame, g.primeTime
  );
}

function sideForCoach(row, coach) {
  if (row.away_coach === coach) return "AWAY";
  if (row.home_coach === coach) return "HOME";
  return null;
}

function coachOutcome(row, coach) {
  const side = sideForCoach(row, coach);
  if (!side) return null;
  const away = finite(row.away_score), home = finite(row.home_score), spread = finite(row.spread_line);
  if (away === null || home === null) return null;
  const margin = home - away;
  const outright = margin === 0 ? "T" : (side === "HOME" ? (margin > 0 ? "W" : "L") : (margin < 0 ? "W" : "L"));
  let covered = null;
  if (spread !== null) {
    if (margin === spread) covered = "P";
    else {
      const homeCovered = margin > spread;
      covered = side === "HOME" ? (homeCovered ? "W" : "L") : (homeCovered ? "L" : "W");
    }
  }
  const favorite = spread === null || spread === 0 ? null : (side === "HOME" ? spread > 0 : spread < 0);
  return { side, outright, covered, favorite };
}

function summarize(rows, coach) {
  let wins = 0, losses = 0, ties = 0, covers = 0, noCovers = 0, pushes = 0;
  rows.forEach((row) => {
    const o = coachOutcome(row, coach);
    if (!o) return;
    if (o.outright === "W") wins += 1; else if (o.outright === "L") losses += 1; else ties += 1;
    if (o.covered === "W") covers += 1; else if (o.covered === "L") noCovers += 1; else if (o.covered === "P") pushes += 1;
  });
  const decisions = wins + losses;
  const spreadDecisions = covers + noCovers;
  return {
    games: rows.length,
    record: { wins, losses, ties, winPct: decisions ? Math.round((wins / decisions) * 1000) / 10 : null },
    spreadRecord: { covers, noCovers, pushes, coverPct: spreadDecisions ? Math.round((covers / spreadDecisions) * 1000) / 10 : null }
  };
}

function filterForCoach(rows, coach, predicate) {
  return rows.filter((row) => {
    const o = coachOutcome(row, coach);
    return o && predicate(row, o);
  });
}

export function coachIndicatorSummary(rows, coach) {
  const overall = summarize(rows, coach);
  const split = (predicate) => summarize(filterForCoach(rows, coach, predicate), coach);
  return {
    coach,
    timeframe: rows.length ? { fromSeason: Math.min(...rows.map((r) => Number(r.season))), toSeason: Math.max(...rows.map((r) => Number(r.season)))} : null,
    overall,
    indicators: {
      primeTime: split((r) => Number(r.prime_time) === 1),
      home: split((r, o) => o.side === "HOME"),
      away: split((r, o) => o.side === "AWAY"),
      favorite: split((r, o) => o.favorite === true),
      underdog: split((r, o) => o.favorite === false),
      division: split((r) => Number(r.div_game) === 1),
      shortRest: split((r, o) => finite(o.side === "HOME" ? r.home_rest : r.away_rest) !== null && finite(o.side === "HOME" ? r.home_rest : r.away_rest) <= 6),
      extraRest: split((r, o) => finite(o.side === "HOME" ? r.home_rest : r.away_rest) !== null && finite(o.side === "HOME" ? r.home_rest : r.away_rest) >= 8),
      restAdvantage3Plus: split((r, o) => {
        const own = finite(o.side === "HOME" ? r.home_rest : r.away_rest);
        const opp = finite(o.side === "HOME" ? r.away_rest : r.home_rest);
        return own !== null && opp !== null && own - opp >= 3;
      }),
      coldOutdoor: split((r) => ["outdoors", "open"].includes(String(r.roof || "").toLowerCase()) && finite(r.temp_f) !== null && finite(r.temp_f) <= 32),
      hotOutdoor: split((r) => ["outdoors", "open"].includes(String(r.roof || "").toLowerCase()) && finite(r.temp_f) !== null && finite(r.temp_f) >= 90),
      windyOutdoor: split((r) => ["outdoors", "open"].includes(String(r.roof || "").toLowerCase()) && finite(r.wind_mph) !== null && finite(r.wind_mph) >= 15)
    }
  };
}

function normalizedAsHistoryRow(g) {
  return {
    season:g.season, week:g.week,
    away_team:g.awayTeam, home_team:g.homeTeam,
    away_score:g.awayScore, home_score:g.homeScore,
    spread_line:g.spreadLine, roof:g.roof, temp_f:g.tempF, wind_mph:g.windMph,
    away_rest:g.awayRest, home_rest:g.homeRest,
    away_coach:g.awayCoach, home_coach:g.homeCoach,
    div_game:g.divGame, prime_time:g.primeTime
  };
}

async function putCoachSummary(db, coach, startSeason, endSeason, summary) {
  await db.prepare(`INSERT INTO historical_coach_summaries(coach,start_season,end_season,summary_json,rebuilt_at)
    VALUES(?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(coach,start_season,end_season) DO UPDATE SET summary_json=excluded.summary_json,rebuilt_at=CURRENT_TIMESTAMP`)
    .bind(coach,startSeason,endSeason,JSON.stringify(summary)).run();
}

export async function rebuildHistoricalCoachSummaries(db, games, { startSeason = 2015, endSeason = 2025 } = {}) {
  await ensureHistorySchema(db);
  const rows = (games || []).map(normalizedAsHistoryRow);
  const coaches = [...new Set((games || []).flatMap((g) => [g.awayCoach,g.homeCoach]).filter(Boolean))].sort();
  await db.prepare(`DELETE FROM historical_coach_summaries WHERE start_season=? AND end_season=?`).bind(startSeason,endSeason).run();
  const statements = coaches.map((coach) => {
    const coachRows = rows.filter((r) => r.away_coach === coach || r.home_coach === coach);
    const summary = coachIndicatorSummary(coachRows,coach);
    return db.prepare(`INSERT INTO historical_coach_summaries(coach,start_season,end_season,summary_json,rebuilt_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)`)
      .bind(coach,startSeason,endSeason,JSON.stringify(summary));
  });
  for (let i=0;i<statements.length;i+=50) await db.batch(statements.slice(i,i+50));
  return { coachesCached:coaches.length };
}

export async function importHistoricalGames(db, { startSeason = 2015, endSeason = 2025, fetchImpl = fetch } = {}) {
  if (!db) throw new Error("Database is not bound");
  if (!Number.isInteger(startSeason) || !Number.isInteger(endSeason) || startSeason > endSeason) throw new Error("Invalid season range");
  if (endSeason - startSeason > 20) throw new Error("Historical import is limited to 21 seasons per request");
  await ensureHistorySchema(db);
  const sourceRows = await fetchScheduleRows(fetchImpl);
  const games = sourceRows.map(normalizeHistoricalGame).filter((g) => validHistoricalGame(g, startSeason, endSeason));
  let imported = 0;
  const batchSize = 60;
  for (let i = 0; i < games.length; i += batchSize) {
    const statements = games.slice(i, i + batchSize).map((g) => upsertStatement(db, g));
    await db.batch(statements);
    imported += statements.length;
  }
  const cache = await rebuildHistoricalCoachSummaries(db,games,{startSeason,endSeason});
  await db.prepare(`DELETE FROM weekly_outlook_cache`).run();
  await db.prepare(`INSERT INTO historical_import_runs(start_season, end_season, games_imported, source_rows) VALUES (?, ?, ?, ?)`)
    .bind(startSeason, endSeason, imported, sourceRows.length).run();
  return {
    startSeason,
    endSeason,
    gamesImported: imported,
    sourceRows: sourceRows.length,
    coachesCached: cache.coachesCached,
    weeklyOutlookCacheInvalidated: true,
    source: "nflverse",
    fields: ["coach", "spread", "score", "rest", "roof", "surface", "temperature", "wind", "stadium", "kickoff", "primetime"]
  };
}

export async function historicalCoachIndicators(db, coach, { startSeason = 2015, endSeason = 2025 } = {}) {
  if (!db) throw new Error("Database is not bound");
  if (!coach) throw new Error("coach is required");
  await ensureHistorySchema(db);
  const cached = await db.prepare(`SELECT summary_json,rebuilt_at FROM historical_coach_summaries WHERE coach=? AND start_season=? AND end_season=? LIMIT 1`)
    .bind(coach,startSeason,endSeason).first();
  if (cached?.summary_json) {
    try { return { ...JSON.parse(cached.summary_json), cache:{ hit:true, rebuiltAt:cached.rebuilt_at } }; } catch {}
  }
  const result = await db.prepare(`
    SELECT * FROM historical_games
    WHERE season BETWEEN ? AND ? AND (away_coach = ? OR home_coach = ?)
    ORDER BY season, week
  `).bind(startSeason, endSeason, coach, coach).all();
  const summary = coachIndicatorSummary(result.results ?? [], coach);
  await putCoachSummary(db,coach,startSeason,endSeason,summary);
  return { ...summary, cache:{ hit:false, rebuiltAt:null } };
}

export async function historyStatus(db) {
  if (!db) throw new Error("Database is not bound");
  await ensureHistorySchema(db);
  const totals = await db.prepare(`SELECT COUNT(*) games, MIN(season) min_season, MAX(season) max_season FROM historical_games`).first();
  const summaries = await db.prepare(`SELECT COUNT(*) summaries, MAX(rebuilt_at) rebuilt_at FROM historical_coach_summaries`).first();
  const latest = await db.prepare(`SELECT * FROM historical_import_runs ORDER BY id DESC LIMIT 1`).first();
  return {
    games: Number(totals?.games ?? 0),
    seasons: totals?.games ? { from: Number(totals.min_season), to: Number(totals.max_season) } : null,
    coachSummaries: Number(summaries?.summaries ?? 0),
    summariesRebuiltAt: summaries?.rebuilt_at ?? null,
    latestImport: latest ?? null
  };
}
