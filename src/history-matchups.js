import { ensureHistorySchema } from "./history-schema.js";
import { loadHistoricalEvidenceSummaries } from "./historical-evidence.js";
import { loadSituationalHistory, situationalEvidenceForGame, situationalSummary } from "./situational-history.js";

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

  const divisions = [
    ["BUF","MIA","NE","NYJ"],["BAL","CIN","CLE","PIT"],["HOU","IND","JAX","TEN"],["DEN","KC","LV","LAC"],
    ["DAL","NYG","PHI","WAS"],["CHI","DET","GB","MIN"],["ATL","CAR","NO","TB"],["ARI","LAR","SF","SEA"]
  ];
  const division = divisions.some((teams) => teams.includes(game.awayCode) && teams.includes(game.homeCode));
  if (division) { away.push("division"); home.push("division"); }

  return { primeTime, division, outdoor, temperatureF: temp, windMph: wind, away, home };
}

const LABELS = Object.freeze({
  primeTime: "Primetime",
  division: "Division game",
  home: "Home games",
  away: "Road games",
  shortRest: "Short rest (6d or less)",
  extraRest: "Extra rest (8d+)",
  restAdvantage3Plus: "Rest advantage (3d+)",
  coldOutdoor: "Cold outdoor (32°F or below)",
  hotOutdoor: "Hot outdoor (90°F+)",
  windyOutdoor: "Windy outdoor (15+ mph)"
});

const CATEGORY_LABELS = Object.freeze({
  AwayFav: "Away Favorite",
  AwayDog: "Away Dog",
  HomeFav: "Home Favorite",
  HomeDog: "Home Dog"
});

const TIER_LABELS = Object.freeze({ "<=3": "0.5–3", "<=7": "3.5–7", ">7": "7.5+" });

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

function cachedSplit(summary, kind, key) {
  if (!summary) return null;
  return kind === "CATEGORY" ? summary.categoryTier?.[key] ?? null : summary.conditions?.[key] ?? null;
}

function evidenceCandidate({ subjectType, subjectLabel, team, split, baseline, label, priority, projectedCode }) {
  const games = Number(split?.games || 0);
  const coverPct = finite(split?.spreadRecord?.coverPct);
  const baselineCoverPct = finite(baseline?.spreadRecord?.coverPct);
  if (games < 5 || coverPct === null || baselineCoverPct === null) return null;
  const baselineGames = Number(baseline?.games || 0);
  const difference = Math.round((coverPct - baselineCoverPct) * 10) / 10;
  let relationship = "NEUTRAL";
  if (projectedCode && Math.abs(difference) >= 5) {
    const subjectSupportsSelf = difference > 0;
    relationship = (team === projectedCode) === subjectSupportsSelf ? "SUPPORTS" : "CONFLICTS";
  }
  return {
    subjectType,
    subjectLabel,
    team,
    label,
    games,
    spreadRecord: split.spreadRecord,
    coverPct,
    timeframe: null,
    baseline: { games: baselineGames, coverPct: baselineCoverPct },
    differenceFromBaseline: difference,
    relationship,
    priority: priority + (team === projectedCode ? 2 : 0)
  };
}

export function phaseTwoEvidence(game, conditions, cache) {
  if (!cache?.league) return [];
  const projectedCode = game.projectedCode || null;
  const candidates = [];
  const add = (candidate, timeframe) => {
    if (!candidate) return;
    candidates.push({ ...candidate, timeframe });
  };
  for (const side of ["away", "home"]) {
    const team = side === "away" ? game.awayCode : game.homeCode;
    const coach = side === "away" ? game.awayCoach : game.homeCoach;
    const teamSummary = cache.teams.get(team) || null;
    const coachSummary = coach ? cache.coaches.get(coach) || null : null;
    const classification = game.classification?.[side] || null;
    const tier = game.classification?.tier || null;
    if (classification && tier) {
      const key = `${classification}|${tier}`;
      const baseline = cachedSplit(cache.league, "CATEGORY", key);
      const label = `${CATEGORY_LABELS[classification] || classification} · ${TIER_LABELS[tier] || tier}`;
      add(evidenceCandidate({subjectType:"TEAM",subjectLabel:"Team",team,split:cachedSplit(teamSummary,"CATEGORY",key),baseline,label,priority:100,projectedCode}),teamSummary?.timeframe||null);
      add(evidenceCandidate({subjectType:"COACH",subjectLabel:coach?`Coach · ${coach}`:"Coach",team,split:cachedSplit(coachSummary,"CATEGORY",key),baseline,label,priority:90,projectedCode}),coachSummary?.timeframe||null);
    }
    for (const key of conditions[side] || []) {
      const baseline = cachedSplit(cache.league, "CONDITION", key);
      const priority = key === "division" ? 75 : ["primeTime","shortRest","extraRest","restAdvantage3Plus","coldOutdoor","hotOutdoor","windyOutdoor"].includes(key) ? 65 : 45;
      add(evidenceCandidate({subjectType:"TEAM",subjectLabel:"Team",team,split:cachedSplit(teamSummary,"CONDITION",key),baseline,label:LABELS[key]||key,priority,projectedCode}),teamSummary?.timeframe||null);
      add(evidenceCandidate({subjectType:"COACH",subjectLabel:coach?`Coach · ${coach}`:"Coach",team,split:cachedSplit(coachSummary,"CONDITION",key),baseline,label:LABELS[key]||key,priority:priority-5,projectedCode}),coachSummary?.timeframe||null);
    }
  }
  return candidates
    .sort((a,b)=>b.priority-a.priority||String(a.team).localeCompare(String(b.team))||a.subjectType.localeCompare(b.subjectType))
    .slice(0,3)
    .map(({priority,...candidate})=>candidate);
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

function buildCurrentGame(game, summaries, evidenceCache, situationalCache) {
  const conditions = currentHistoricalConditions(game);
  const awaySummary = game.awayCoach ? summaries.get(game.awayCoach) || null : null;
  const homeSummary = game.homeCoach ? summaries.get(game.homeCoach) || null : null;
  const away = sidePayload(game.awayCode, game.awayCoach, awaySummary, conditions.away);
  const home = sidePayload(game.homeCode, game.homeCoach, homeSummary, conditions.home);
  const notableCount = away.notable.length + home.notable.length;
  const evidence = phaseTwoEvidence(game, conditions, evidenceCache);
  const situational = situationalEvidenceForGame(game, situationalCache);
  return {
    gameId: game.gameId,
    awayCode: game.awayCode,
    homeCode: game.homeCode,
    kickoffAt: game.kickoffAt,
    conditions,
    away,
    home,
    evidence,
    evidenceSummary: {
      supports: evidence.filter((item) => item.relationship === "SUPPORTS").length,
      conflicts: evidence.filter((item) => item.relationship === "CONFLICTS").length,
      neutral: evidence.filter((item) => item.relationship === "NEUTRAL").length
    },
    situational,
    situationalSummary: situationalSummary(situational),
    notableCount,
    hasNotableHistory: notableCount > 0,
    historyCacheReady: away.cacheAvailable || home.cacheAvailable
  };
}

export async function historicalIndicatorsForCurrentGame(db, game, range = { startSeason: 2015, endSeason: 2025 }) {
  const [summaries,evidenceCache,situationalCache] = await Promise.all([loadSummaryMap(db, range),loadHistoricalEvidenceSummaries(db),loadSituationalHistory(db)]);
  return buildCurrentGame(game, summaries, evidenceCache, situationalCache);
}

export async function historicalIndicatorsForWeek(db, games, range = { startSeason: 2015, endSeason: 2025 }) {
  const [summaries,evidenceCache,situationalCache] = await Promise.all([loadSummaryMap(db, range),loadHistoricalEvidenceSummaries(db),loadSituationalHistory(db)]);
  return (games || []).map((game) => buildCurrentGame(game, summaries, evidenceCache, situationalCache));
}
