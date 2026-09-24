import { median } from "./consensus.js";
import { noVigProbabilities } from "./moneyline.js";
import { ensureMarketSchema } from "./market-schema.js";
import { isPregameSnapshot } from "./pregame-markets.js";
import { dedupeCanonicalMatchups } from "./team-codes.js";

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

function oneDecimal(value) {
  return value === null ? null : Math.round(value * 10) / 10;
}

function medianPrice(values) {
  const numbers = (Array.isArray(values) ? values : [])
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!numbers.length) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2
    ? numbers[middle]
    : Math.round((numbers[middle - 1] + numbers[middle]) / 2);
}

function summarizeMoneylineMovement(game, snapshots = []) {
  const ordered = (Array.isArray(snapshots) ? snapshots : [])
    .map((row) => ({
      id: Number(row.id),
      source: String(row.source ?? ""),
      awayMoneyline: finiteNumber(row.away_moneyline),
      homeMoneyline: finiteNumber(row.home_moneyline),
      capturedAt: row.captured_at ?? null
    }))
    .filter((row) => Number.isFinite(row.id) && row.source && row.awayMoneyline !== null && row.homeMoneyline !== null && isPregameSnapshot(row.capturedAt,game?.kickoff_at))
    .sort((a, b) => a.id - b.id);

  const firstBySource = new Map();
  const latestBySource = new Map();
  for (const row of ordered) {
    if (!firstBySource.has(row.source)) firstBySource.set(row.source, row);
    latestBySource.set(row.source, row);
  }

  const firstRows = [...firstBySource.values()];
  const latestRows = [...latestBySource.values()];
  const averageNoVig = (rows, side) => {
    const probabilities = rows
      .map((row) => noVigProbabilities(row.awayMoneyline, row.homeMoneyline)?.[side])
      .filter(Number.isFinite);
    if (!probabilities.length) return null;
    return probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length * 100;
  };

  const openingAwayProbability = averageNoVig(firstRows, "away");
  const currentAwayProbability = averageNoVig(latestRows, "away");
  const probabilityDeltaAway = openingAwayProbability === null || currentAwayProbability === null
    ? null
    : oneDecimal(currentAwayProbability - openingAwayProbability);

  let direction = "UNKNOWN";
  if (probabilityDeltaAway !== null) {
    if (probabilityDeltaAway > 0) direction = "TOWARD_AWAY";
    else if (probabilityDeltaAway < 0) direction = "TOWARD_HOME";
    else direction = "UNCHANGED";
  }

  let towardAwayBookmakers = 0;
  let towardHomeBookmakers = 0;
  let unchangedBookmakers = 0;
  for (const first of firstRows) {
    const latest = latestBySource.get(first.source);
    if (!latest) continue;
    const opening = noVigProbabilities(first.awayMoneyline, first.homeMoneyline)?.away;
    const current = noVigProbabilities(latest.awayMoneyline, latest.homeMoneyline)?.away;
    if (!Number.isFinite(opening) || !Number.isFinite(current)) continue;
    const delta = current - opening;
    if (Math.abs(delta) < 0.0005) unchangedBookmakers += 1;
    else if (delta > 0) towardAwayBookmakers += 1;
    else towardHomeBookmakers += 1;
  }

  const latestTimes = latestRows
    .map((row) => new Date(row.capturedAt).getTime())
    .filter(Number.isFinite);
  const completed = String(game?.status ?? "").toUpperCase() === "COMPLETED";

  return {
    openingAwayMoneyline: medianPrice(firstRows.map((row) => row.awayMoneyline)),
    openingHomeMoneyline: medianPrice(firstRows.map((row) => row.homeMoneyline)),
    currentAwayMoneyline: medianPrice(latestRows.map((row) => row.awayMoneyline)),
    currentHomeMoneyline: medianPrice(latestRows.map((row) => row.homeMoneyline)),
    closingAwayMoneyline: completed ? medianPrice(latestRows.map((row) => row.awayMoneyline)) : null,
    closingHomeMoneyline: completed ? medianPrice(latestRows.map((row) => row.homeMoneyline)) : null,
    openingAwayNoVigProbability: oneDecimal(openingAwayProbability),
    openingHomeNoVigProbability: openingAwayProbability === null ? null : oneDecimal(100 - openingAwayProbability),
    currentAwayNoVigProbability: oneDecimal(currentAwayProbability),
    currentHomeNoVigProbability: currentAwayProbability === null ? null : oneDecimal(100 - currentAwayProbability),
    probabilityPointsAway: probabilityDeltaAway,
    probabilityMagnitude: probabilityDeltaAway === null ? null : Math.abs(probabilityDeltaAway),
    direction,
    bookmakerCount: latestRows.length,
    changedBookmakers: towardAwayBookmakers + towardHomeBookmakers,
    towardAwayBookmakers,
    towardHomeBookmakers,
    unchangedBookmakers,
    snapshotCount: ordered.length,
    lastCapturedAt: latestTimes.length ? new Date(Math.max(...latestTimes)).toISOString() : null,
    openingDefinition: "median_prices_and_average_no_vig_probability_of_each_bookmakers_first_stored_market",
    currentDefinition: "median_prices_and_average_no_vig_probability_of_each_bookmakers_latest_stored_market",
    closingDefinition: "latest_stored_pregame_moneyline_when_game_is_completed"
  };
}

function marketAlignment(spreadDirection, moneylineDirection) {
  if (spreadDirection === "UNKNOWN" || moneylineDirection === "UNKNOWN") return "INCOMPLETE";
  const spreadMoved = spreadDirection === "TOWARD_AWAY" || spreadDirection === "TOWARD_HOME";
  const moneylineMoved = moneylineDirection === "TOWARD_AWAY" || moneylineDirection === "TOWARD_HOME";
  if (spreadMoved && moneylineMoved) return spreadDirection === moneylineDirection ? "ALIGNED" : "DIVERGENT";
  if (!spreadMoved && !moneylineMoved) return "STABLE";
  return spreadMoved ? "SPREAD_ONLY" : "MONEYLINE_ONLY";
}

export function summarizeLineMovement(game, snapshots = [], moneylineSnapshots = []) {
  if (!game) return null;

  const ordered = (Array.isArray(snapshots) ? snapshots : [])
    .map((row) => ({
      id: Number(row.id),
      source: String(row.source ?? ""),
      awaySpread: finiteNumber(row.away_spread),
      capturedAt: row.captured_at ?? null
    }))
    .filter((row) => Number.isFinite(row.id) && row.source && row.awaySpread !== null && isPregameSnapshot(row.capturedAt,game?.kickoff_at))
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
  const completed = String(game?.status ?? "").toUpperCase() === "COMPLETED";
  const closingAwaySpread = completed ? currentAwaySpread : null;
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

  const moneyline = summarizeMoneylineMovement(game, moneylineSnapshots);

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
    closingDefinition: "latest_consensus_strictly_before_kickoff",
    moneyline,
    marketAlignment: marketAlignment(direction, moneyline.direction)
  };
}

export async function lineMovementForGame(db, gameId) {
  if (!db) throw new Error("Database is not bound");
  await ensureMarketSchema(db);
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
    WHERE game_id = ? AND julianday(captured_at) < julianday(?)
    ORDER BY id ASC
  `).bind(id,game.kickoff_at).all();

  const moneylineResult = await db.prepare(`
    SELECT id, source, away_moneyline, home_moneyline, captured_at
    FROM moneyline_snapshots
    WHERE game_id = ? AND julianday(captured_at) < julianday(?)
    ORDER BY id ASC
  `).bind(id,game.kickoff_at).all();

  return summarizeLineMovement(game, result.results ?? [], moneylineResult.results ?? []);
}

export async function lineMovementsForWeek(db, season, week) {
  if (!db) throw new Error("Database is not bound");
  await ensureMarketSchema(db);
  const year = Number(season);
  const weekNumber = Number(week);
  if (!Number.isInteger(year) || !Number.isInteger(weekNumber)) throw new Error("season and week are required");

  const gamesResult = await db.prepare(`
    SELECT id, season, week, away_team, home_team, kickoff_at, status, closing_away_spread
    FROM games
    WHERE season = ? AND week = ? AND season_type = 'REGULAR'
    ORDER BY kickoff_at ASC, id ASC
  `).bind(year, weekNumber).all();
  const games = dedupeCanonicalMatchups(gamesResult.results ?? []);
  if (!games.length) return [];

  const snapshotsResult = await db.prepare(`
    SELECT ls.id, ls.game_id, ls.source, ls.away_spread, ls.captured_at
    FROM line_snapshots ls
    JOIN games g ON g.id = ls.game_id
    WHERE g.season = ? AND g.week = ? AND g.season_type = 'REGULAR'
      AND julianday(ls.captured_at) < julianday(g.kickoff_at)
    ORDER BY ls.id ASC
  `).bind(year, weekNumber).all();

  const moneylineSnapshotsResult = await db.prepare(`
    SELECT ml.id, ml.game_id, ml.source, ml.away_moneyline, ml.home_moneyline, ml.captured_at
    FROM moneyline_snapshots ml
    JOIN games g ON g.id = ml.game_id
    WHERE g.season = ? AND g.week = ? AND g.season_type = 'REGULAR'
      AND julianday(ml.captured_at) < julianday(g.kickoff_at)
    ORDER BY ml.id ASC
  `).bind(year, weekNumber).all();

  const byGame = new Map();
  for (const row of snapshotsResult.results ?? []) {
    const id = String(row.game_id);
    if (!byGame.has(id)) byGame.set(id, []);
    byGame.get(id).push(row);
  }

  const moneylinesByGame = new Map();
  for (const row of moneylineSnapshotsResult.results ?? []) {
    const id = String(row.game_id);
    if (!moneylinesByGame.has(id)) moneylinesByGame.set(id, []);
    moneylinesByGame.get(id).push(row);
  }

  return games.map((game) => summarizeLineMovement(
    game,
    byGame.get(String(game.id)) ?? [],
    moneylinesByGame.get(String(game.id)) ?? []
  ));
}
