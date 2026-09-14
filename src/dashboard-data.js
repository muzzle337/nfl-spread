import { projectionsForWeek } from "./projection.js";
import { weekResultsStatus } from "./result-sync.js";
import { settleAgainstSpread } from "./engine.js";

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
    SELECT
      week,
      COUNT(*) AS total_games,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' AND away_score IS NOT NULL AND home_score IS NOT NULL THEN 1 ELSE 0 END), 0) AS completed_games
    FROM games
    WHERE season = ? AND season_type = 'REGULAR'
    GROUP BY week
    ORDER BY week ASC
  `).bind(season).all();

  const weeks = (result.results ?? []).map((row) => ({
    week: Number(row.week),
    totalGames: Number(row.total_games ?? 0),
    completedGames: Number(row.completed_games ?? 0)
  })).filter((row) => Number.isInteger(row.week));

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

  const [projection, results] = await Promise.all([
    projectionsForWeek(db, target.season, target.week),
    weekResultsStatus(db, target.season, target.week, now)
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
    return {
      ...game,
      status: result?.status ?? game.status ?? null,
      final,
      live,
      postgame: postgameAnalysis(game, final, projection.liveWeekStats)
    };
  });

  return {
    ...projection,
    games,
    results
  };
}
