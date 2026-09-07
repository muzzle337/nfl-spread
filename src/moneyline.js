function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function americanToImpliedProbability(price) {
  const value = finiteNumber(price);
  if (value === null || value === 0) return null;
  return value > 0 ? 100 / (value + 100) : (-value) / ((-value) + 100);
}

export function probabilityToAmerican(probability) {
  const p = Number(probability);
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return null;
  const price = p >= 0.5 ? -(100 * p) / (1 - p) : (100 * (1 - p)) / p;
  return Math.round(price);
}

export function noVigProbabilities(awayMoneyline, homeMoneyline) {
  const awayRaw = americanToImpliedProbability(awayMoneyline);
  const homeRaw = americanToImpliedProbability(homeMoneyline);
  if (awayRaw === null || homeRaw === null) return null;
  const total = awayRaw + homeRaw;
  if (!Number.isFinite(total) || total <= 0) return null;
  return { away: awayRaw / total, home: homeRaw / total };
}

function median(values) {
  const numbers = (Array.isArray(values) ? values : [])
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!numbers.length) return null;
  const middle = Math.floor(numbers.length / 2);
  if (numbers.length % 2) return numbers[middle];
  return Math.round((numbers[middle - 1] + numbers[middle]) / 2);
}

export function consensusMoneylineForGame(game, latestBooks) {
  const books = (Array.isArray(latestBooks) ? latestBooks : [])
    .map((book) => {
      const awayMoneyline = finiteNumber(book.away_moneyline ?? book.awayMoneyline);
      const homeMoneyline = finiteNumber(book.home_moneyline ?? book.homeMoneyline);
      if (awayMoneyline === null || homeMoneyline === null) return null;
      const probabilities = noVigProbabilities(awayMoneyline, homeMoneyline);
      if (!probabilities) return null;
      return {
        source: book.source ?? book.key,
        capturedAt: book.captured_at ?? book.capturedAt ?? book.lastUpdate ?? null,
        awayMoneyline,
        homeMoneyline,
        awayWinProbability: probabilities.away,
        homeWinProbability: probabilities.home
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.source).localeCompare(String(b.source)));

  const awayProbability = books.length
    ? books.reduce((sum, book) => sum + book.awayWinProbability, 0) / books.length
    : null;
  const homeProbability = books.length
    ? books.reduce((sum, book) => sum + book.homeWinProbability, 0) / books.length
    : null;

  return {
    id: game.id,
    moneylineBookmakerCount: books.length,
    consensusAwayMoneyline: median(books.map((book) => book.awayMoneyline)),
    consensusHomeMoneyline: median(books.map((book) => book.homeMoneyline)),
    awayWinProbability: awayProbability === null ? null : Math.round(awayProbability * 1000) / 10,
    homeWinProbability: homeProbability === null ? null : Math.round(homeProbability * 1000) / 10,
    books
  };
}

export async function latestMoneylineForGame(db, gameId) {
  const result = await db.prepare(`
    SELECT source, away_moneyline, home_moneyline, captured_at
    FROM moneyline_snapshots ml
    WHERE ml.game_id = ?
      AND ml.id = (
        SELECT MAX(inner_ml.id)
        FROM moneyline_snapshots inner_ml
        WHERE inner_ml.game_id = ml.game_id
          AND inner_ml.source = ml.source
      )
    ORDER BY source ASC
  `).bind(gameId).all();
  return result.results ?? [];
}

export async function moneylineForGame(db, game) {
  const latest = await latestMoneylineForGame(db, game.id);
  return consensusMoneylineForGame(game, latest);
}
