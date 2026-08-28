import { median } from "./consensus.js";

function validFinalScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 ? score : null;
}

export function finalScoreUpdate(game) {
  if (!game?.completed) return null;
  const awayScore = validFinalScore(game.awayScore);
  const homeScore = validFinalScore(game.homeScore);
  if (awayScore === null || homeScore === null) return null;

  return {
    id: game.id,
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    awayScore,
    homeScore
  };
}

async function latestConsensusAwaySpread(db, gameId) {
  const result = await db.prepare(`
    SELECT away_spread
    FROM line_snapshots ls
    WHERE ls.game_id = ?
      AND ls.id = (
        SELECT MAX(inner_ls.id)
        FROM line_snapshots inner_ls
        WHERE inner_ls.game_id = ls.game_id
          AND inner_ls.source = ls.source
      )
    ORDER BY source ASC
  `).bind(gameId).all();

  return median((result.results ?? []).map((row) => row.away_spread));
}

export async function ingestCompletedScores(db, scoreGames) {
  if (!db) throw new Error("Database is not bound");

  let completedReceived = 0;
  let gamesUpdated = 0;
  let gamesUnchanged = 0;
  let gamesNotStored = 0;
  let gamesInvalid = 0;
  let nonFinalIgnored = 0;

  for (const game of Array.isArray(scoreGames) ? scoreGames : []) {
    if (!game?.completed) {
      nonFinalIgnored += 1;
      continue;
    }

    completedReceived += 1;
    const update = finalScoreUpdate(game);
    if (!update) {
      gamesInvalid += 1;
      continue;
    }

    const existing = await db.prepare(`
      SELECT id, status, away_score, home_score, closing_away_spread
      FROM games
      WHERE id = ?
      LIMIT 1
    `).bind(update.id).first();

    if (!existing) {
      gamesNotStored += 1;
      continue;
    }

    const sameScores = Number(existing.away_score) === update.awayScore
      && Number(existing.home_score) === update.homeScore;
    const alreadyComplete = existing.status === "COMPLETED";

    if (sameScores && alreadyComplete && existing.closing_away_spread !== null && existing.closing_away_spread !== undefined) {
      gamesUnchanged += 1;
      continue;
    }

    const closingAwaySpread = existing.closing_away_spread ?? await latestConsensusAwaySpread(db, update.id);

    await db.prepare(`
      UPDATE games
      SET
        away_score = ?,
        home_score = ?,
        status = 'COMPLETED',
        closing_away_spread = COALESCE(closing_away_spread, ?),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      update.awayScore,
      update.homeScore,
      closingAwaySpread,
      update.id
    ).run();

    gamesUpdated += 1;
  }

  return {
    scoreEventsReceived: Array.isArray(scoreGames) ? scoreGames.length : 0,
    completedReceived,
    gamesUpdated,
    gamesUnchanged,
    gamesNotStored,
    gamesInvalid,
    nonFinalIgnored
  };
}
