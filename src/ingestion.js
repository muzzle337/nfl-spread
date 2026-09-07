import { consensusMoneylineForGame } from "./moneyline.js";
import { ensureMarketSchema } from "./market-schema.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function nflRegularSeasonStartUtc(year) {
  const septemberFirst = new Date(Date.UTC(year, 8, 1));
  const daysUntilMonday = (8 - septemberFirst.getUTCDay()) % 7;
  const laborDay = new Date(septemberFirst.getTime() + daysUntilMonday * DAY_MS);
  return new Date(laborDay.getTime() + 3 * DAY_MS);
}

export function nflWeekForCommenceTime(commenceTime) {
  const kickoff = new Date(commenceTime);
  if (Number.isNaN(kickoff.getTime())) return null;

  const season = kickoff.getUTCFullYear();
  const seasonStart = nflRegularSeasonStartUtc(season);
  const week = Math.floor((kickoff.getTime() - seasonStart.getTime()) / (7 * DAY_MS)) + 1;

  return {
    season,
    week: Math.max(1, week),
    seasonType: "REGULAR"
  };
}

export function selectEarliestUpcomingWeek(games, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const upcoming = (Array.isArray(games) ? games : [])
    .map((game) => ({ game, kickoffMs: new Date(game.commenceTime).getTime(), meta: nflWeekForCommenceTime(game.commenceTime) }))
    .filter((item) => Number.isFinite(item.kickoffMs) && item.kickoffMs >= nowMs && item.meta)
    .sort((a, b) => a.kickoffMs - b.kickoffMs);

  if (!upcoming.length) return { season: null, week: null, seasonType: "REGULAR", games: [] };

  const target = upcoming[0].meta;
  return {
    ...target,
    games: upcoming
      .filter((item) => item.meta.season === target.season && item.meta.week === target.week)
      .map((item) => item.game)
  };
}

export function spreadChanged(latestSpread, incomingSpread) {
  if (latestSpread === null || latestSpread === undefined) return true;
  const previous = Number(latestSpread);
  const incoming = Number(incomingSpread);
  if (!Number.isFinite(previous) || !Number.isFinite(incoming)) return true;
  return previous !== incoming;
}

export function moneylineChanged(latest, awayMoneyline, homeMoneyline) {
  if (!latest) return true;
  const previousAway = Number(latest.away_moneyline);
  const previousHome = Number(latest.home_moneyline);
  const incomingAway = Number(awayMoneyline);
  const incomingHome = Number(homeMoneyline);
  if (![previousAway, previousHome, incomingAway, incomingHome].every(Number.isFinite)) return true;
  return previousAway !== incomingAway || previousHome !== incomingHome;
}

export function hasMarketNumber(value) {
  if (value === null || value === undefined || value === "") return false;
  return Number.isFinite(Number(value));
}

function gamesContainMoneyline(games) {
  return (Array.isArray(games) ? games : []).some((game) =>
    (game.books ?? []).some((book) =>
      hasMarketNumber(book.awayMoneyline) && hasMarketNumber(book.homeMoneyline)
    )
  );
}

function median(values) {
  const numbers = (values ?? []).filter(hasMarketNumber).map(Number).sort((a, b) => a - b);
  if (!numbers.length) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
}

async function latestSpreadForSource(db, gameId, source) {
  return db.prepare(`
    SELECT away_spread
    FROM line_snapshots
    WHERE game_id = ? AND source = ?
    ORDER BY id DESC
    LIMIT 1
  `).bind(gameId, source).first();
}

async function latestMoneylineForSource(db, gameId, source) {
  return db.prepare(`
    SELECT away_moneyline, home_moneyline
    FROM moneyline_snapshots
    WHERE game_id = ? AND source = ?
    ORDER BY id DESC
    LIMIT 1
  `).bind(gameId, source).first();
}

export async function storeFutureSurvivorMarkets(db, games, selection, now = new Date()) {
  if (!selection?.season || !selection?.week) return 0;
  await ensureMarketSchema(db);
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  let stored = 0;

  for (const game of Array.isArray(games) ? games : []) {
    const meta = nflWeekForCommenceTime(game.commenceTime);
    const kickoffMs = new Date(game.commenceTime).getTime();
    if (!meta || !Number.isFinite(kickoffMs) || kickoffMs < nowMs) continue;
    if (meta.season !== selection.season || meta.week <= selection.week || meta.week > selection.week + 5) continue;

    const completeMlBooks = (game.books ?? []).filter((book) => hasMarketNumber(book.awayMoneyline) && hasMarketNumber(book.homeMoneyline));
    if (!completeMlBooks.length) continue;
    const ml = consensusMoneylineForGame({ id: game.id }, completeMlBooks);
    const awaySpread = median((game.books ?? []).map((book) => book.awaySpread));
    const homeSpread = median((game.books ?? []).map((book) => book.homeSpread));

    await db.prepare(`
      INSERT INTO survivor_future_markets(
        season, week, game_id, away_team, home_team, kickoff_at,
        away_moneyline, home_moneyline, away_win_probability, home_win_probability,
        away_spread, home_spread, bookmaker_count, captured_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(season, week, game_id) DO UPDATE SET
        away_team = excluded.away_team,
        home_team = excluded.home_team,
        kickoff_at = excluded.kickoff_at,
        away_moneyline = excluded.away_moneyline,
        home_moneyline = excluded.home_moneyline,
        away_win_probability = excluded.away_win_probability,
        home_win_probability = excluded.home_win_probability,
        away_spread = excluded.away_spread,
        home_spread = excluded.home_spread,
        bookmaker_count = excluded.bookmaker_count,
        captured_at = excluded.captured_at
    `).bind(
      meta.season,
      meta.week,
      game.id,
      game.awayTeam,
      game.homeTeam,
      game.commenceTime,
      ml.consensusAwayMoneyline,
      ml.consensusHomeMoneyline,
      ml.awayWinProbability,
      ml.homeWinProbability,
      awaySpread,
      homeSpread,
      ml.moneylineBookmakerCount,
      new Date().toISOString()
    ).run();
    stored += 1;
  }

  return stored;
}

export async function ingestWeeklySpreads(db, games, now = new Date()) {
  if (!db) throw new Error("Database is not bound");
  const hasMoneyline = gamesContainMoneyline(games);
  if (hasMoneyline) await ensureMarketSchema(db);

  const selection = selectEarliestUpcomingWeek(games, now);
  let gamesUpserted = 0;
  let snapshotsInserted = 0;
  let snapshotsUnchanged = 0;
  let moneylineSnapshotsInserted = 0;
  let moneylineSnapshotsUnchanged = 0;

  for (const game of selection.games) {
    await db.prepare(`
      INSERT INTO games(id, season, week, season_type, away_team, home_team, kickoff_at, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        season = excluded.season,
        week = excluded.week,
        season_type = excluded.season_type,
        away_team = excluded.away_team,
        home_team = excluded.home_team,
        kickoff_at = excluded.kickoff_at,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      game.id,
      selection.season,
      selection.week,
      selection.seasonType,
      game.awayTeam,
      game.homeTeam,
      game.commenceTime
    ).run();
    gamesUpserted += 1;

    for (const book of game.books ?? []) {
      if (hasMarketNumber(book.awaySpread) && hasMarketNumber(book.homeSpread)) {
        const latest = await latestSpreadForSource(db, game.id, book.key);
        if (!spreadChanged(latest?.away_spread, book.awaySpread)) {
          snapshotsUnchanged += 1;
        } else {
          await db.prepare(`
            INSERT INTO line_snapshots(game_id, captured_at, away_spread, source)
            VALUES (?, ?, ?, ?)
          `).bind(game.id, book.lastUpdate ?? new Date().toISOString(), book.awaySpread, book.key).run();
          snapshotsInserted += 1;
        }
      }

      if (hasMoneyline && hasMarketNumber(book.awayMoneyline) && hasMarketNumber(book.homeMoneyline)) {
        const latestMoneyline = await latestMoneylineForSource(db, game.id, book.key);
        if (!moneylineChanged(latestMoneyline, book.awayMoneyline, book.homeMoneyline)) {
          moneylineSnapshotsUnchanged += 1;
        } else {
          await db.prepare(`
            INSERT INTO moneyline_snapshots(game_id, captured_at, away_moneyline, home_moneyline, source)
            VALUES (?, ?, ?, ?, ?)
          `).bind(game.id, book.lastUpdate ?? new Date().toISOString(), book.awayMoneyline, book.homeMoneyline, book.key).run();
          moneylineSnapshotsInserted += 1;
        }
      }
    }
  }

  const futureSurvivorMarketsStored = hasMoneyline
    ? await storeFutureSurvivorMarkets(db, games, selection, now)
    : 0;

  return {
    season: selection.season,
    week: selection.week,
    seasonType: selection.seasonType,
    gamesSelected: selection.games.length,
    gamesUpserted,
    snapshotsInserted,
    snapshotsUnchanged,
    moneylineSnapshotsInserted,
    moneylineSnapshotsUnchanged,
    futureSurvivorMarketsStored
  };
}
