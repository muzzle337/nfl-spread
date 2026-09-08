import { historicalCoachIndicators } from "./history.js";

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
  // During the NFL season, standard US primetime windows start around 23:00–01:30 UTC.
  // This intentionally excludes normal 17:00/20:00 UTC Sunday windows and morning international games.
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

  return {
    primeTime,
    outdoor,
    temperatureF: temp,
    windMph: wind,
    away,
    home
  };
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
  return {
    key,
    label: LABELS[key] || key,
    games: Number(split.games || 0),
    record: split.record,
    spreadRecord: split.spreadRecord
  };
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
    notable: splits.filter(notableHistoricalSplit)
  };
}

export async function historicalIndicatorsForCurrentGame(db, game, range = { startSeason: 2015, endSeason: 2025 }) {
  const conditions = currentHistoricalConditions(game);
  const [awaySummary, homeSummary] = await Promise.all([
    game.awayCoach ? historicalCoachIndicators(db, game.awayCoach, range) : Promise.resolve(null),
    game.homeCoach ? historicalCoachIndicators(db, game.homeCoach, range) : Promise.resolve(null)
  ]);
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
    hasNotableHistory: notableCount > 0
  };
}

export async function historicalIndicatorsForWeek(db, games, range = { startSeason: 2015, endSeason: 2025 }) {
  const out = [];
  for (const game of games || []) out.push(await historicalIndicatorsForCurrentGame(db, game, range));
  return out;
}
