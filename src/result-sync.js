import { fetchNflScores } from "./odds.js";
import { ingestCompletedScores } from "./results.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const FINAL_GRACE_HOURS = 6;
export const SCORE_LOOKBACK_DAYS = 3;

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

function finalized(row) {
  return row?.status === "COMPLETED"
    && row?.away_score !== null
    && row?.away_score !== undefined
    && row?.home_score !== null
    && row?.home_score !== undefined;
}

export function partitionMissingFinals(rows, now = new Date(), lookbackDays = SCORE_LOOKBACK_DAYS) {
  const nowDate = asDate(now);
  const oldestEligibleMs = nowDate.getTime() - lookbackDays * DAY_MS;
  const missing = Array.isArray(rows) ? rows : [];
  const eligibleForAutoSync = [];
  const staleMissing = [];

  for (const row of missing) {
    const kickoffMs = new Date(row.kickoff_at ?? row.kickoffAt).getTime();
    if (Number.isFinite(kickoffMs) && kickoffMs >= oldestEligibleMs) {
      eligibleForAutoSync.push(row);
    } else {
      staleMissing.push(row);
    }
  }

  return { eligibleForAutoSync, staleMissing };
}

export async function missingFinalGames(db, now = new Date(), graceHours = FINAL_GRACE_HOURS) {
  if (!db) throw new Error("Database is not bound");
  const nowDate = asDate(now);
  const cutoff = new Date(nowDate.getTime() - graceHours * HOUR_MS).toISOString();

  const result = await db.prepare(`
    SELECT
      id,
      season,
      week,
      away_team,
      home_team,
      kickoff_at,
      status,
      away_score,
      home_score
    FROM games
    WHERE season_type = 'REGULAR'
      AND julianday(kickoff_at) <= julianday(?)
      AND (
        status <> 'COMPLETED'
        OR away_score IS NULL
        OR home_score IS NULL
      )
    ORDER BY kickoff_at ASC
  `).bind(cutoff).all();

  return result.results ?? [];
}

export async function resultsIntegrity(db, now = new Date()) {
  const nowDate = asDate(now);
  const missing = await missingFinalGames(db, nowDate, FINAL_GRACE_HOURS);
  const { eligibleForAutoSync, staleMissing } = partitionMissingFinals(
    missing,
    nowDate,
    SCORE_LOOKBACK_DAYS
  );

  return {
    checkedAt: nowDate.toISOString(),
    finalGraceHours: FINAL_GRACE_HOURS,
    scoreLookbackDays: SCORE_LOOKBACK_DAYS,
    missingCount: missing.length,
    eligibleForAutoSyncCount: eligibleForAutoSync.length,
    staleMissingCount: staleMissing.length,
    missing: missing.map((row) => ({
      id: row.id,
      season: Number(row.season),
      week: Number(row.week),
      awayTeam: row.away_team,
      homeTeam: row.home_team,
      kickoffAt: row.kickoff_at,
      status: row.status,
      awayScore: row.away_score ?? null,
      homeScore: row.home_score ?? null,
      autoSyncEligible: eligibleForAutoSync.some((candidate) => candidate.id === row.id)
    }))
  };
}

export async function weekResultsStatus(db, season, week, now = new Date()) {
  if (!db) throw new Error("Database is not bound");
  const seasonNumber = Number(season);
  const weekNumber = Number(week);
  if (!Number.isInteger(seasonNumber) || !Number.isInteger(weekNumber) || weekNumber < 1) {
    throw new Error("season and week must be integers");
  }

  const nowDate = asDate(now);
  const graceCutoffMs = nowDate.getTime() - FINAL_GRACE_HOURS * HOUR_MS;
  const result = await db.prepare(`
    SELECT id, away_team, home_team, kickoff_at, status, away_score, home_score
    FROM games
    WHERE season = ? AND week = ? AND season_type = 'REGULAR'
    ORDER BY kickoff_at ASC
  `).bind(seasonNumber, weekNumber).all();

  const rows = result.results ?? [];
  let completedGames = 0;
  let awaitingCompletion = 0;
  const missing = [];

  for (const row of rows) {
    if (finalized(row)) {
      completedGames += 1;
      continue;
    }

    const kickoffMs = new Date(row.kickoff_at).getTime();
    if (Number.isFinite(kickoffMs) && kickoffMs > graceCutoffMs) {
      awaitingCompletion += 1;
    } else {
      missing.push({
        id: row.id,
        awayTeam: row.away_team,
        homeTeam: row.home_team,
        kickoffAt: row.kickoff_at,
        status: row.status,
        awayScore: row.away_score ?? null,
        homeScore: row.home_score ?? null
      });
    }
  }

  return {
    season: seasonNumber,
    week: weekNumber,
    totalGames: rows.length,
    completedGames,
    awaitingCompletion,
    missingFinals: missing.length,
    weekComplete: rows.length > 0 && completedGames === rows.length,
    missing
  };
}

export async function syncResultsIfDue({
  db,
  apiKey,
  now = new Date(),
  fetchScores = fetchNflScores
}) {
  if (!db) throw new Error("Database is not bound");
  if (!apiKey) throw new Error("ODDS_API_KEY is not configured");

  const before = await resultsIntegrity(db, now);
  if (before.eligibleForAutoSyncCount === 0) {
    return {
      apiCalled: false,
      reason: before.staleMissingCount > 0 ? "MISSING_OUTSIDE_SCORE_LOOKBACK" : "NO_RESULTS_DUE",
      lookbackDays: SCORE_LOOKBACK_DAYS,
      quota: null,
      integrityBefore: before,
      integrityAfter: before,
      ingestion: null
    };
  }

  const result = await fetchScores({ apiKey, daysFrom: SCORE_LOOKBACK_DAYS });
  const ingestion = await ingestCompletedScores(db, result.games);
  const after = await resultsIntegrity(db, now);

  return {
    apiCalled: true,
    reason: "RESULTS_DUE",
    lookbackDays: SCORE_LOOKBACK_DAYS,
    quota: result.quota,
    integrityBefore: before,
    integrityAfter: after,
    ingestion
  };
}
