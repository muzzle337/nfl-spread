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

async function latestSpreadForSource(db, gameId, source) {
  return db.prepare(`
    SELECT away_spread
    FROM line_snapshots
    WHERE game_id = ? AND source = ?
    ORDER BY id DESC
    LIMIT 1
  `).bind(gameId, source).first();
}

export async function ingestWeeklySpreads(db, games, now = new Date()) {
  if (!db) throw new Error("Database is not bound");

  const selection = selectEarliestUpcomingWeek(games, now);
  let gamesUpserted = 0;
  let snapshotsInserted = 0;
  let snapshotsUnchanged = 0;

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
      const latest = await latestSpreadForSource(db, game.id, book.key);
      if (!spreadChanged(latest?.away_spread, book.awaySpread)) {
        snapshotsUnchanged += 1;
        continue;
      }

      await db.prepare(`
        INSERT INTO line_snapshots(game_id, captured_at, away_spread, source)
        VALUES (?, ?, ?, ?)
      `).bind(
        game.id,
        book.lastUpdate ?? new Date().toISOString(),
        book.awaySpread,
        book.key
      ).run();
      snapshotsInserted += 1;
    }
  }

  return {
    season: selection.season,
    week: selection.week,
    seasonType: selection.seasonType,
    gamesSelected: selection.games.length,
    gamesUpserted,
    snapshotsInserted,
    snapshotsUnchanged
  };
}
