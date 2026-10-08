import { projectionsForWeek } from "./projection.js";
import { weekResultsStatus } from "./result-sync.js";
import { settleAgainstSpread } from "./engine.js";
import { seasonTierPulse } from "./tier-contributors.js";
import { canonicalTeamCode, dedupeCanonicalMatchups } from "./team-codes.js";
import { buildTrendWatch } from "./trend-watch.js";

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function tierBucket(stats, classification, tier) {
  if (!classification || !tier) return null;
  return stats?.buckets?.[`${classification}|${tier}`] ?? null;
}

function postgameAnalysis(game, final, liveWeekStats) {
  if (!final || !game?.classification) return null;
  const awaySpread = finiteNumber(game.medianAwaySpread);
  const homeSpread = finiteNumber(game.medianHomeSpread);
  const awayScore = finiteNumber(final.awayScore);
  const homeScore = finiteNumber(final.homeScore);
  if ([awaySpread, homeSpread, awayScore, homeScore].some((value) => value === null)) return null;

  let settlement;
  try {
    settlement = settleAgainstSpread({ awaySpread, homeSpread, awayScore, homeScore });
  } catch {
    return null;
  }

  const tier = game.classification.tier;
  if (settlement.coveringSide === "Push") {
    const bucket = tierBucket(liveWeekStats, game.classification.away, tier);
    return {
      spreadResult: "PUSH",
      coveringSide: "PUSH",
      coveringTeam: null,
      classification: null,
      tier,
      liveBucket: bucket
    };
  }

  const awayCovered = settlement.coveringSide === "Away";
  const classification = awayCovered ? game.classification.away : game.classification.home;
  const bucket = tierBucket(liveWeekStats, classification, tier);
  return {
    spreadResult: "COVER",
    coveringSide: awayCovered ? "AWAY" : "HOME",
    coveringTeam: awayCovered ? game.awayTeam : game.homeTeam,
    classification,
    tier,
    liveBucket: bucket
  };
}

function blankTeamRecord() {
  return { wins:0, losses:0, ties:0, pointsFor:0, pointsAgainst:0, pointDiff:0 };
}

export function buildTeamRecordsFromGames(games) {
  const records = new Map();
  function recordFor(team) {
    const code = canonicalTeamCode(team);
    if (!records.has(code)) records.set(code, blankTeamRecord());
    return records.get(code);
  }

  for (const game of dedupeCanonicalMatchups(Array.isArray(games) ? games : [])) {
    if (String(game?.status ?? "").toUpperCase() !== "COMPLETED") continue;
    const awayScore = finiteNumber(game.away_score ?? game.awayScore);
    const homeScore = finiteNumber(game.home_score ?? game.homeScore);
    if (awayScore === null || homeScore === null) continue;
    const away = recordFor(game.away_team ?? game.awayTeam);
    const home = recordFor(game.home_team ?? game.homeTeam);
    away.pointsFor += awayScore;
    away.pointsAgainst += homeScore;
    home.pointsFor += homeScore;
    home.pointsAgainst += awayScore;
    if (awayScore > homeScore) {
      away.wins += 1;
      home.losses += 1;
    } else if (homeScore > awayScore) {
      home.wins += 1;
      away.losses += 1;
    } else {
      away.ties += 1;
      home.ties += 1;
    }
  }

  for (const record of records.values()) record.pointDiff = record.pointsFor - record.pointsAgainst;
  return records;
}

async function teamRecordsThroughWeek(db, season, week) {
  const result = await db.prepare(`
    SELECT id,season,week,away_team,home_team,status,away_score,home_score
    FROM games
    WHERE season = ? AND week <= ? AND season_type = 'REGULAR'
      AND status = 'COMPLETED' AND away_score IS NOT NULL AND home_score IS NOT NULL
    ORDER BY week ASC,id ASC
  `).bind(season, week).all();
  return buildTeamRecordsFromGames(result.results ?? []);
}

export async function resolveDashboardWeek(db) {
  if (!db) throw new Error("Database is not bound");

  const latest = await db.prepare(`
    SELECT MAX(season) AS season
    FROM games
    WHERE season_type = 'REGULAR'
  `).first();

  if (latest?.season === null || latest?.season === undefined || latest?.season === "") {
    return { season: null, week: null };
  }

  const season = Number(latest.season);
  if (!Number.isInteger(season)) return { season: null, week: null };

  const result = await db.prepare(`
    SELECT id,season,week,away_team,home_team,status,away_score,home_score
    FROM games
    WHERE season = ? AND season_type = 'REGULAR'
    ORDER BY week ASC,id ASC
  `).bind(season).all();

  const byWeek = new Map();
  for (const row of dedupeCanonicalMatchups(result.results ?? [])) {
    const week = Number(row.week);
    if (!Number.isInteger(week)) continue;
    const summary = byWeek.get(week) ?? { week, totalGames:0, completedGames:0 };
    summary.totalGames += 1;
    if (row.status === "COMPLETED" && row.away_score != null && row.home_score != null) summary.completedGames += 1;
    byWeek.set(week,summary);
  }
  const weeks = [...byWeek.values()].sort((a,b)=>a.week-b.week);

  if (!weeks.length) return { season, week: null };

  const active = weeks.find((row) => row.completedGames < row.totalGames);
  return { season, week: (active ?? weeks[weeks.length - 1]).week };
}

export async function dashboardSnapshot(db, now = new Date(), selected = null) {
  const requestedSeason = Number(selected?.season);
  const requestedWeek = Number(selected?.week);
  const target = Number.isInteger(requestedSeason) && Number.isInteger(requestedWeek) && requestedWeek > 0
    ? { season: requestedSeason, week: requestedWeek }
    : await resolveDashboardWeek(db);
  if (target.season === null || target.week === null) {
    return {
      season: target.season,
      week: target.week,
      gameCount: 0,
      focusCount: 0,
      games: [],
      results: null
    };
  }

  const [projection, results, seasonPulse, teamRecords] = await Promise.all([
    projectionsForWeek(db, target.season, target.week),
    weekResultsStatus(db, target.season, target.week, now),
    seasonTierPulse(db, target.season),
    teamRecordsThroughWeek(db, target.season, target.week)
  ]);

  const resultById = new Map((results.games ?? []).map((game) => [String(game.id), game]));
  const games = (projection.games ?? []).map((game) => {
    const result = resultById.get(String(game.id));
    const isFinal = Boolean(result?.final);
    const awayScore = finiteNumber(result?.awayScore);
    const homeScore = finiteNumber(result?.homeScore);
    const final = isFinal ? { awayScore, homeScore } : null;
    const live = !isFinal && result?.status === "LIVE" && awayScore !== null && homeScore !== null
      ? { awayScore, homeScore }
      : null;
    const awayRecord = teamRecords.get(canonicalTeamCode(game.awayTeam)) ?? blankTeamRecord();
    const homeRecord = teamRecords.get(canonicalTeamCode(game.homeTeam)) ?? blankTeamRecord();
    return {
      ...game,
      status: result?.status ?? game.status ?? null,
      final,
      live,
      teamRecords:{ away:{...awayRecord}, home:{...homeRecord} },
      postgame: postgameAnalysis(game, final, projection.liveWeekStats)
    };
  });

  return {
    ...projection,
    seasonPulse,
    trendWatch:buildTrendWatch(seasonPulse,games),
    games,
    results
  };
}
