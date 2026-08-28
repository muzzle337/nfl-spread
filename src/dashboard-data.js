import { projectionsForWeek } from "./projection.js";
import { weekResultsStatus } from "./result-sync.js";

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

export async function dashboardSnapshot(db, now = new Date()) {
  const target = await resolveDashboardWeek(db);
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

  return {
    ...projection,
    results
  };
}
