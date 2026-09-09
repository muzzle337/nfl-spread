import { ensureHistorySchema } from "./history-schema.js";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isOutdoor(roof) {
  return ["outdoors", "open", "outdoor"].includes(String(roof || "").toLowerCase());
}

export function isCurrentPrimeTime(kickoffAt) {
  if (!kickoffAt) return false;
  const d = new Date(kickoffAt);
  if (Number.isNaN(d.getTime())) return false;
  const h = d.getUTCHours();
  return h >= 23 || h <= 2;
}

export function currentHistoricalConditions(game) {
  const awayRest = finite(game.awayRest);
  const homeRest = finite(game.homeRest);
  const temp = finite(game.weather?.temperatureF);
  const wind = finite(game.weather?.windMph);
  const outdoor = isOutdoor(game.roof);
  const primeTime = isCurrentPrimeTime(game.kickoffAt);
  const common = [];
  if (primeTime) common.push("primeTime");
  if (outdoor && temp !== null && temp <= 32) common.push("coldOutdoor");
  if (outdoor && temp !== null && temp >= 90) common.push("hotOutdoor");
  if (outdoor && wind !== null && wind >= 15) common.push("windyOutdoor");

  const away = ["away", ...common];
  const home = ["home", ...common];
  if (awayRest !== null && awayRest <= 6) away.push("shortRest");
  if (homeRest !== null && homeRest <= 6) home.push("shortRest");
  if (awayRest !== null && awayRest >= 8) away.push("extraRest");
  if (homeRest !== null && homeRest >= 8) home.push("extraRest");
  if (awayRest !== null && homeRest !== null && awayRest - homeRest >= 3) away.push("restAdvantage3Plus");
  if (awayRest !== null && homeRest !== null && homeRest - awayRest >= 3) home.push("restAdvantage3Plus");

  return { primeTime, outdoor, temperatureF: temp, windMph: wind, away, home };
}

const LABELS = Object.freeze({
  primeTime: "Primetime",
  home: "Home games",
  away: "Road games",
  shortRest: "Short rest (6d or less)",
  extraRest: "Extra rest (8d+)",
  restAdvantage3Plus: "Rest advantage (3d+)",
  coldOutdoor: "Cold outdoor (32°F or below)",
  hotOutdoor: "Hot outdoor (90°F+)",
  windyOutdoor: "Windy outdoor (15+ mph)"
});

function splitPayload(summary, key) {
  const split = summary?.indicators?.[key];
  if (!split) return null;
  return { key, label: LABELS[key] || key, games: Number(split.games || 0), record: split.record, spreadRecord: split.spreadRecord };
}

export function notableHistoricalSplit(split) {
  if (!split || split.games < 5) return false;
  const cover = finite(split.spreadRecord?.coverPct);
  const win = finite(split.record?.winPct);
  return (cover !== null && (cover >= 60 || cover <= 40)) || (win !== null && (win >= 65 || win <= 35));
}

function sidePayload(code, coach, summary, keys) {
  const splits = keys.map((k) => splitPayload(summary, k)).filter(Boolean);
  return {
    code,
    coach,
    timeframe: summary?.timeframe || null,
    overall: summary?.overall || null,
    applicable: splits,
    notable: splits.filter(notableHistoricalSplit),
    cacheAvailable: Boolean(summary)
  };
}

async function loadSummaryMap(db, range) {
  await ensureHistorySchema(db);
  const startSeason = Number(range?.startSeason ?? 2015);
  const endSeason = Number(range?.endSeason ?? 2025);
  const r = await db.prepare(`SELECT coach,summary_json,rebuilt_at FROM historical_coach_summaries WHERE start_season=? AND end_season=?`)
    .bind(startSeason, endSeason).all();
  const map = new Map();
  for (const row of r.results || []) {
    try {
      map.set(row.coach, { ...JSON.parse(row.summary_json), cache:{ hit:true, rebuiltAt:row.rebuilt_at } });
    } catch {}
  }
  return map;
}

function buildCurrentGame(game, summaries) {
  const conditions = currentHistoricalConditions(game);
  const awaySummary = game.awayCoach ? summaries.get(game.awayCoach) || null : null;
  const homeSummary = game.homeCoach ? summaries.get(game.homeCoach) || null : null;
  const away = sidePayload(game.awayCode, game.awayCoach, awaySummary, conditions.away);
  const home = sidePayload(game.homeCode, game.homeCoach, homeSummary, conditions.home);
  const notableCount = away.notable.length + home.notable.length;
  return {
    gameId: game.gameId,
    awayCode: game.awayCode,
    homeCode: game.homeCode,
    kickoffAt: game.kickoffAt,
    conditions,
    away,
    home,
    notableCount,
    hasNotableHistory: notableCount > 0,
    historyCacheReady: away.cacheAvailable || home.cacheAvailable
  };
}

export async function historicalIndicatorsForCurrentGame(db, game, range = { startSeason: 2015, endSeason: 2025 }) {
  const summaries = await loadSummaryMap(db, range);
  return buildCurrentGame(game, summaries);
}

export async function historicalIndicatorsForWeek(db, games, range = { startSeason: 2015, endSeason: 2025 }) {
  const summaries = await loadSummaryMap(db, range);
  return (games || []).map((game) => buildCurrentGame(game, summaries));
}
