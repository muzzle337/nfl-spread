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
    commenceTime: game.commenceTime ?? null,
    awayScore,
    homeScore
  };
}

function scoreStateUpdate(game) {
  const awayScore = validFinalScore(game?.awayScore);
  const homeScore = validFinalScore(game?.homeScore);
  if (awayScore === null || homeScore === null) return null;
  return {
    id: game?.id ?? null,
    awayTeam: game?.awayTeam ?? null,
    homeTeam: game?.homeTeam ?? null,
    commenceTime: game?.commenceTime ?? null,
    awayScore,
    homeScore
  };
}

async function latestConsensusAwaySpread(db, gameId) {
  const result = await db.prepare(`
    SELECT away_spread
    FROM line_snapshots ls
    WHERE ls.game_id = ?
      AND julianday(ls.captured_at) < (SELECT julianday(kickoff_at) FROM games WHERE id = ?)
      AND ls.id = (
        SELECT MAX(inner_ls.id)
        FROM line_snapshots inner_ls
        WHERE inner_ls.game_id = ls.game_id
          AND inner_ls.source = ls.source
          AND julianday(inner_ls.captured_at) < (SELECT julianday(kickoff_at) FROM games WHERE id = ?)
      )
    ORDER BY source ASC
  `).bind(gameId,gameId,gameId).all();

  return median((result.results ?? []).map((row) => row.away_spread));
}

async function storedGameForScore(db, update) {
  if (update.id) {
    const exact = await db.prepare(`
      SELECT id, status, away_score, home_score, closing_away_spread, kickoff_at
      FROM games
      WHERE id = ?
      LIMIT 1
    `).bind(update.id).first();
    if (exact) return { row: exact, matchedBy: "provider_id" };
  }

  if (!update.awayTeam || !update.homeTeam) return { row: null, matchedBy: null };

  const kickoff = update.commenceTime ? new Date(update.commenceTime) : null;
  const kickoffIso = kickoff && !Number.isNaN(kickoff.getTime()) ? kickoff.toISOString() : null;

  const fallback = kickoffIso
    ? await db.prepare(`
        SELECT id, status, away_score, home_score, closing_away_spread, kickoff_at
        FROM games
        WHERE away_team = ?
          AND home_team = ?
          AND ABS((julianday(kickoff_at) - julianday(?)) * 24.0) <= 12
        ORDER BY ABS((julianday(kickoff_at) - julianday(?)) * 24.0) ASC
        LIMIT 1
      `).bind(update.awayTeam, update.homeTeam, kickoffIso, kickoffIso).first()
    : await db.prepare(`
        SELECT id, status, away_score, home_score, closing_away_spread, kickoff_at
        FROM games
        WHERE away_team = ? AND home_team = ?
        ORDER BY julianday(kickoff_at) DESC
        LIMIT 1
      `).bind(update.awayTeam, update.homeTeam).first();

  return { row: fallback ?? null, matchedBy: fallback ? "teams_kickoff" : null };
}

export async function ingestLiveScores(db, scoreGames, now = new Date()) {
  if (!db) throw new Error("Database is not bound");
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  let liveReceived = 0;
  let gamesUpdated = 0;
  let gamesUnchanged = 0;
  let gamesNotStored = 0;
  let gamesInvalid = 0;
  let futureIgnored = 0;
  let completedIgnored = 0;

  for (const game of Array.isArray(scoreGames) ? scoreGames : []) {
    if (game?.completed === true) {
      completedIgnored += 1;
      continue;
    }
    const update = scoreStateUpdate(game);
    if (!update) {
      gamesInvalid += 1;
      continue;
    }
    const kickoffMs = new Date(update.commenceTime).getTime();
    if (!Number.isFinite(kickoffMs) || kickoffMs > nowMs) {
      futureIgnored += 1;
      continue;
    }
    liveReceived += 1;
    const match = await storedGameForScore(db, update);
    const existing = match.row;
    if (!existing) {
      gamesNotStored += 1;
      continue;
    }
    if (existing.status === "COMPLETED") {
      gamesUnchanged += 1;
      continue;
    }
    const sameScores = Number(existing.away_score) === update.awayScore
      && Number(existing.home_score) === update.homeScore;
    if (sameScores && existing.status === "LIVE") {
      gamesUnchanged += 1;
      continue;
    }
    await db.prepare(`
      UPDATE games
      SET away_score = ?, home_score = ?, status = 'LIVE', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status <> 'COMPLETED'
    `).bind(update.awayScore, update.homeScore, existing.id).run();
    gamesUpdated += 1;
  }

  return {
    scoreEventsReceived: Array.isArray(scoreGames) ? scoreGames.length : 0,
    liveReceived,
    gamesUpdated,
    gamesUnchanged,
    gamesNotStored,
    gamesInvalid,
    futureIgnored,
    completedIgnored
  };
}

export async function ingestCompletedScores(db, scoreGames) {
  if (!db) throw new Error("Database is not bound");

  let completedReceived = 0;
  let gamesUpdated = 0;
  let gamesUnchanged = 0;
  let gamesNotStored = 0;
  let gamesInvalid = 0;
  let nonFinalIgnored = 0;
  let matchedByProviderId = 0;
  let matchedByTeamsKickoff = 0;

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

    const match = await storedGameForScore(db, update);
    const existing = match.row;

    if (!existing) {
      gamesNotStored += 1;
      continue;
    }

    if (match.matchedBy === "provider_id") matchedByProviderId += 1;
    if (match.matchedBy === "teams_kickoff") matchedByTeamsKickoff += 1;

    const sameScores = Number(existing.away_score) === update.awayScore
      && Number(existing.home_score) === update.homeScore;
    const alreadyComplete = existing.status === "COMPLETED";

    if (sameScores && alreadyComplete && existing.closing_away_spread !== null && existing.closing_away_spread !== undefined) {
      gamesUnchanged += 1;
      continue;
    }

    const closingAwaySpread = existing.closing_away_spread ?? await latestConsensusAwaySpread(db, existing.id);

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
      existing.id
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
    nonFinalIgnored,
    matchedByProviderId,
    matchedByTeamsKickoff
  };
}
