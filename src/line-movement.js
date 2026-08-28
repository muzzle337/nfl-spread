import { median } from "./consensus.js";

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rounded(value) {
  return value === null ? null : Math.round(value * 100) / 100;
}

function opposite(spread) {
  if (spread === null) return null;
  return spread === 0 ? 0 : -spread;
}

export function summarizeLineMovement(game, snapshots = []) {
  if (!game) return null;

  const ordered = (Array.isArray(snapshots) ? snapshots : [])
    .map((row) => ({
      id: Number(row.id),
      source: String(row.source ?? ""),
      awaySpread: finiteNumber(row.away_spread),
      capturedAt: row.captured_at ?? null
    }))
    .filter((row) => Number.isFinite(row.id) && row.source && row.awaySpread !== null)
    .sort((a, b) => a.id - b.id);

  const firstBySource = new Map();
  const latestBySource = new Map();
  for (const row of ordered) {
    if (!firstBySource.has(row.source)) firstBySource.set(row.source, row);
    latestBySource.set(row.source, row);
  }

  const firstRows = [...firstBySource.values()];
  const latestRows = [...latestBySource.values()];
  const firstAwaySpread = median(firstRows.map((row) => row.awaySpread));
  const currentAwaySpread = median(latestRows.map((row) => row.awaySpread));
  const closingAwaySpread = finiteNumber(game.closing_away_spread);
  const delta = firstAwaySpread === null || currentAwaySpread === null
    ? null
    : rounded(currentAwaySpread - firstAwaySpread);

  let direction = "UNKNOWN";
  if (delta !== null) {
    if (delta < 0) direction = "TOWARD_AWAY";
    else if (delta > 0) direction = "TOWARD_HOME";
    else direction = "UNCHANGED";
  }

  const changedBookmakers = firstRows.reduce((count, first) => {
    const latest = latestBySource.get(first.source);
    return count + (latest && latest.awaySpread !== first.awaySpread ? 1 : 0);
  }, 0);

  const latestTimes = latestRows
    .map((row) => new Date(row.capturedAt).getTime())
    .filter(Number.isFinite);

  return {
    gameId: game.id,
    season: Number(game.season),
    week: Number(game.week),
    awayTeam: game.away_team,
    homeTeam: game.home_team,
    kickoffAt: game.kickoff_at,
    status: game.status,
    firstCapturedAwaySpread: firstAwaySpread,
    firstCapturedHomeSpread: opposite(firstAwaySpread),
    currentAwaySpread,
    currentHomeSpread: opposite(currentAwaySpread),
    closingAwaySpread,
    closingHomeSpread: opposite(closingAwaySpread),
    movementPointsAway: delta,
    movementMagnitude: delta === null ? null : Math.abs(delta),
    direction,
    bookmakerCount: latestRows.length,
    changedBookmakers,
    snapshotCount: ordered.length,
    lastCapturedAt: latestTimes.length ? new Date(Math.max(...latestTimes)).toISOString() : null,
    firstCapturedDefinition: "median_of_each_bookmakers_first_stored_line",
    currentDefinition: "median_of_each_bookmakers_latest_stored_line",
    closingDefinition: "last_stored_consensus_before_result_sync"
  };
}

export async function lineMovementForGame(db, gameId) {
  if (!db) throw new Error("Database is not bound");
  const id = String(gameId ?? "").trim();
  if (!id) throw new Error("game is required");

  const game = await db.prepare(`
    SELECT id, season, week, away_team, home_team, kickoff_at, status, closing_away_spread
    FROM games
    WHERE id = ?
    LIMIT 1
  `).bind(id).first();

  if (!game) return null;

  const result = await db.prepare(`
    SELECT id, source, away_spread, captured_at
    FROM line_snapshots
    WHERE game_id = ?
    ORDER BY id ASC
  `).bind(id).all();

  return summarizeLineMovement(game, result.results ?? []);
}

export async function lineMovementsForWeek(db, season, week) {
  if (!db) throw new Error("Database is not bound");
  const year = Number(season);
  const weekNumber = Number(week);
  if (!Number.isInteger(year) || !Number.isInteger(weekNumber)) throw new Error("season and week are required");

  const gamesResult = await db.prepare(`
    SELECT id, season, week, away_team, home_team, kickoff_at, status, closing_away_spread
    FROM games
    WHERE season = ? AND week = ? AND season_type = 'REGULAR'
    ORDER BY kickoff_at ASC, id ASC
  `).bind(year, weekNumber).all();
  const games = gamesResult.results ?? [];
  if (!games.length) return [];

  const snapshotsResult = await db.prepare(`
    SELECT ls.id, ls.game_id, ls.source, ls.away_spread, ls.captured_at
    FROM line_snapshots ls
    JOIN games g ON g.id = ls.game_id
    WHERE g.season = ? AND g.week = ? AND g.season_type = 'REGULAR'
    ORDER BY ls.id ASC
  `).bind(year, weekNumber).all();

  const byGame = new Map();
  for (const row of snapshotsResult.results ?? []) {
    const id = String(row.game_id);
    if (!byGame.has(id)) byGame.set(id, []);
    byGame.get(id).push(row);
  }

  return games.map((game) => summarizeLineMovement(game, byGame.get(String(game.id)) ?? []));
}
