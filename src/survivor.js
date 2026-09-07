import { consensusLinesForWeek } from "./consensus.js";
import { ensureMarketSchema } from "./market-schema.js";
import { moneylineForGame } from "./moneyline.js";

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function storedGamesForWeek(db, season, week) {
  const result = await db.prepare(`
    SELECT id, season, week, season_type, away_team, home_team, kickoff_at, status
    FROM games
    WHERE season = ? AND week = ? AND season_type = 'REGULAR'
    ORDER BY kickoff_at ASC, id ASC
  `).bind(season, week).all();
  return result.results ?? [];
}

async function usedTeamsForEntry(db, entryId, season) {
  if (!entryId) return [];
  const result = await db.prepare(`
    SELECT team
    FROM survivor_picks
    WHERE entry_id = ? AND season = ?
    ORDER BY week ASC
  `).bind(entryId, season).all();
  return (result.results ?? []).map((row) => row.team);
}

export async function survivorRecommendations(db, season, week, entryId = null) {
  if (!db) throw new Error("Database is not bound");
  await ensureMarketSchema(db);

  const seasonNumber = Number(season);
  const weekNumber = Number(week);
  const entryNumber = entryId === null || entryId === undefined || entryId === "" ? null : Number(entryId);
  if (!Number.isInteger(seasonNumber) || !Number.isInteger(weekNumber) || weekNumber < 1) {
    throw new Error("Season and week must be valid integers");
  }
  if (entryNumber !== null && !Number.isInteger(entryNumber)) throw new Error("entry must be an integer");

  const [games, usedTeams, spreadConsensus] = await Promise.all([
    storedGamesForWeek(db, seasonNumber, weekNumber),
    usedTeamsForEntry(db, entryNumber, seasonNumber),
    consensusLinesForWeek(db, seasonNumber, weekNumber)
  ]);
  const used = new Set(usedTeams);
  const spreadByGame = new Map((spreadConsensus.games ?? []).map((game) => [game.id, game]));
  const candidates = [];

  for (const game of games) {
    const market = await moneylineForGame(db, game);
    const spread = spreadByGame.get(game.id);
    const awaySpread = finiteNumber(spread?.medianAwaySpread);
    const homeSpread = finiteNumber(spread?.medianHomeSpread);
    const sides = [
      {
        side: "AWAY",
        team: game.away_team,
        opponent: game.home_team,
        moneyline: market.consensusAwayMoneyline,
        winProbability: market.awayWinProbability,
        spread: awaySpread
      },
      {
        side: "HOME",
        team: game.home_team,
        opponent: game.away_team,
        moneyline: market.consensusHomeMoneyline,
        winProbability: market.homeWinProbability,
        spread: homeSpread
      }
    ];

    for (const side of sides) {
      const probability = finiteNumber(side.winProbability);
      if (probability === null) continue;
      candidates.push({
        gameId: game.id,
        kickoffAt: game.kickoff_at,
        side: side.side,
        team: side.team,
        opponent: side.opponent,
        moneyline: finiteNumber(side.moneyline),
        spread: finiteNumber(side.spread),
        winProbability: probability,
        used: used.has(side.team),
        available: !used.has(side.team),
        bookmakerCount: market.moneylineBookmakerCount
      });
    }
  }

  const ranked = candidates.sort((a, b) =>
    b.winProbability - a.winProbability ||
    (a.moneyline ?? 99999) - (b.moneyline ?? 99999) ||
    a.team.localeCompare(b.team)
  );
  const available = ranked.filter((candidate) => candidate.available);

  return {
    season: seasonNumber,
    week: weekNumber,
    entryId: entryNumber,
    usedTeams,
    recommendationBasis: "current_consensus_moneyline_no_vig_probability",
    strategyVersion: "safety_first_v1",
    note: "Future-week value and portfolio diversification are not yet included in this first Survivor foundation.",
    safestPick: available[0] ?? null,
    candidates: ranked
  };
}

export async function listSurvivorEntries(db, season) {
  if (!db) throw new Error("Database is not bound");
  await ensureMarketSchema(db);
  const seasonNumber = Number(season);
  if (!Number.isInteger(seasonNumber)) throw new Error("Season must be an integer");

  const result = await db.prepare(`
    SELECT id, season, name, active, created_at, updated_at
    FROM survivor_entries
    WHERE season = ?
    ORDER BY id ASC
  `).bind(seasonNumber).all();
  return (result.results ?? []).map((row) => ({
    id: Number(row.id),
    season: Number(row.season),
    name: row.name,
    active: Number(row.active) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function createSurvivorEntry(db, season, name) {
  if (!db) throw new Error("Database is not bound");
  await ensureMarketSchema(db);
  const seasonNumber = Number(season);
  const cleanName = String(name ?? "").trim();
  if (!Number.isInteger(seasonNumber)) throw new Error("Season must be an integer");
  if (!cleanName) throw new Error("Entry name is required");

  await db.prepare(`
    INSERT INTO survivor_entries(season, name, active, updated_at)
    VALUES (?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(season, name) DO UPDATE SET active = 1, updated_at = CURRENT_TIMESTAMP
  `).bind(seasonNumber, cleanName).run();

  const row = await db.prepare(`
    SELECT id, season, name, active
    FROM survivor_entries
    WHERE season = ? AND name = ?
  `).bind(seasonNumber, cleanName).first();

  return { id: Number(row.id), season: Number(row.season), name: row.name, active: Number(row.active) === 1 };
}

export async function recordSurvivorPick(db, { entryId, season, week, team, gameId = null }) {
  if (!db) throw new Error("Database is not bound");
  await ensureMarketSchema(db);
  const entryNumber = Number(entryId);
  const seasonNumber = Number(season);
  const weekNumber = Number(week);
  const cleanTeam = String(team ?? "").trim();
  if (![entryNumber, seasonNumber, weekNumber].every(Number.isInteger)) throw new Error("entryId, season, and week must be integers");
  if (!cleanTeam) throw new Error("Team is required");

  const duplicate = await db.prepare(`
    SELECT id, week
    FROM survivor_picks
    WHERE entry_id = ? AND season = ? AND team = ? AND week <> ?
    LIMIT 1
  `).bind(entryNumber, seasonNumber, cleanTeam, weekNumber).first();
  if (duplicate) throw new Error(`${cleanTeam} was already used in Week ${duplicate.week}`);

  await db.prepare(`
    INSERT INTO survivor_picks(entry_id, season, week, team, game_id, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(entry_id, week) DO UPDATE SET
      team = excluded.team,
      game_id = excluded.game_id,
      updated_at = CURRENT_TIMESTAMP
  `).bind(entryNumber, seasonNumber, weekNumber, cleanTeam, gameId).run();

  return { entryId: entryNumber, season: seasonNumber, week: weekNumber, team: cleanTeam, gameId };
}
