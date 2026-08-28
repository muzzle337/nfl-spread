function validSpreadNumbers(values) {
  return (Array.isArray(values) ? values : [])
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

export function median(values) {
  const numbers = validSpreadNumbers(values);
  if (!numbers.length) return null;

  // Nearest-rank 50th percentile. For an even number of books this selects
  // the lower of the two middle market lines instead of inventing a quarter
  // point (for example, -1.25). The result is always a line actually offered
  // by at least one sportsbook in the current market snapshot.
  const medianIndex = Math.ceil(numbers.length * 0.5) - 1;
  return numbers[medianIndex];
}

export function consensusForGame(game, latestBooks) {
  const books = (Array.isArray(latestBooks) ? latestBooks : [])
    .filter((book) => book.away_spread !== null && book.away_spread !== undefined && Number.isFinite(Number(book.away_spread)))
    .map((book) => ({
      source: book.source,
      awaySpread: Number(book.away_spread),
      capturedAt: book.captured_at
    }))
    .sort((a, b) => a.source.localeCompare(b.source));

  const awaySpreads = books.map((book) => book.awaySpread);
  const medianAwaySpread = median(awaySpreads);
  const medianHomeSpread = medianAwaySpread === null
    ? null
    : medianAwaySpread === 0
      ? 0
      : -medianAwaySpread;

  return {
    id: game.id,
    season: Number(game.season),
    week: Number(game.week),
    seasonType: game.season_type,
    awayTeam: game.away_team,
    homeTeam: game.home_team,
    kickoffAt: game.kickoff_at,
    status: game.status,
    medianAwaySpread,
    medianHomeSpread,
    bookmakerCount: books.length,
    minAwaySpread: awaySpreads.length ? Math.min(...awaySpreads) : null,
    maxAwaySpread: awaySpreads.length ? Math.max(...awaySpreads) : null,
    books
  };
}

export async function consensusLinesForWeek(db, season, week) {
  if (!db) throw new Error("Database is not bound");
  const seasonNumber = Number(season);
  const weekNumber = Number(week);
  if (!Number.isInteger(seasonNumber) || !Number.isInteger(weekNumber)) {
    throw new Error("Season and week must be integers");
  }

  const gamesResult = await db.prepare(`
    SELECT id, season, week, season_type, away_team, home_team, kickoff_at, status
    FROM games
    WHERE season = ? AND week = ?
    ORDER BY kickoff_at ASC, id ASC
  `).bind(seasonNumber, weekNumber).all();

  const games = gamesResult.results ?? [];
  const output = [];

  for (const game of games) {
    const latestResult = await db.prepare(`
      SELECT source, away_spread, captured_at
      FROM line_snapshots ls
      WHERE ls.game_id = ?
        AND ls.id = (
          SELECT MAX(inner_ls.id)
          FROM line_snapshots inner_ls
          WHERE inner_ls.game_id = ls.game_id
            AND inner_ls.source = ls.source
        )
      ORDER BY source ASC
    `).bind(game.id).all();

    output.push(consensusForGame(game, latestResult.results ?? []));
  }

  return {
    season: seasonNumber,
    week: weekNumber,
    gameCount: output.length,
    consensusMethod: "nearest_rank_median_latest_bookmaker_spreads",
    games: output
  };
}
