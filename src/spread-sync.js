import { ingestWeeklySpreads } from "./ingestion.js";
import { fetchNflSpreads } from "./odds.js";

const HOUR_MS = 60 * 60 * 1000;

export const SPREAD_REFRESH_CRON = "35 * * * *";

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

export function spreadRefreshIntervalHours(hoursToKickoff) {
  const hours = Number(hoursToKickoff);
  if (!Number.isFinite(hours) || hours < 0) return null;
  if (hours <= 6) return 2;
  if (hours <= 24) return 6;
  if (hours <= 72) return 12;
  return 24;
}

async function nextUpcomingGame(db, now) {
  return db.prepare(`
    SELECT id, season, week, away_team, home_team, kickoff_at
    FROM games
    WHERE season_type = 'REGULAR'
      AND status <> 'COMPLETED'
      AND julianday(kickoff_at) > julianday(?)
    ORDER BY julianday(kickoff_at) ASC, id ASC
    LIMIT 1
  `).bind(now.toISOString()).first();
}

async function lastSuccessfulSpreadRequest(db) {
  return db.prepare(`
    SELECT
      request_type,
      strftime('%Y-%m-%dT%H:%M:%SZ', requested_at) AS requested_at_iso
    FROM api_usage
    WHERE provider = 'the-odds-api'
      AND success = 1
      AND request_type IN ('nfl_ingest', 'nfl_spreads', 'nfl_auto_spreads')
    ORDER BY id DESC
    LIMIT 1
  `).first();
}

export async function spreadRefreshStatus(db, now = new Date()) {
  if (!db) throw new Error("Database is not bound");
  const nowDate = asDate(now);
  const game = await nextUpcomingGame(db, nowDate);

  if (!game) {
    return {
      checkedAt: nowDate.toISOString(),
      due: false,
      reason: "NO_UPCOMING_GAMES",
      nextGame: null,
      hoursToKickoff: null,
      refreshIntervalHours: null,
      lastSuccessfulRefreshAt: null,
      hoursSinceRefresh: null,
      nextRefreshDueAt: null
    };
  }

  const kickoff = asDate(game.kickoff_at);
  const hoursToKickoff = Math.max(0, (kickoff.getTime() - nowDate.getTime()) / HOUR_MS);
  const refreshIntervalHours = spreadRefreshIntervalHours(hoursToKickoff);
  const latest = await lastSuccessfulSpreadRequest(db);
  const lastRefresh = latest?.requested_at_iso ? new Date(latest.requested_at_iso) : null;
  const validLastRefresh = lastRefresh && !Number.isNaN(lastRefresh.getTime()) ? lastRefresh : null;

  if (!validLastRefresh) {
    return {
      checkedAt: nowDate.toISOString(),
      due: true,
      reason: "NEVER_REFRESHED",
      nextGame: {
        id: game.id,
        season: Number(game.season),
        week: Number(game.week),
        awayTeam: game.away_team,
        homeTeam: game.home_team,
        kickoffAt: game.kickoff_at
      },
      hoursToKickoff: Math.round(hoursToKickoff * 10) / 10,
      refreshIntervalHours,
      lastSuccessfulRefreshAt: null,
      hoursSinceRefresh: null,
      nextRefreshDueAt: nowDate.toISOString()
    };
  }

  const hoursSinceRefresh = Math.max(0, (nowDate.getTime() - validLastRefresh.getTime()) / HOUR_MS);
  const due = hoursSinceRefresh >= refreshIntervalHours;
  const nextRefreshDueAt = new Date(validLastRefresh.getTime() + refreshIntervalHours * HOUR_MS).toISOString();

  return {
    checkedAt: nowDate.toISOString(),
    due,
    reason: due ? "REFRESH_DUE" : "FRESH_ENOUGH",
    nextGame: {
      id: game.id,
      season: Number(game.season),
      week: Number(game.week),
      awayTeam: game.away_team,
      homeTeam: game.home_team,
      kickoffAt: game.kickoff_at
    },
    hoursToKickoff: Math.round(hoursToKickoff * 10) / 10,
    refreshIntervalHours,
    lastSuccessfulRefreshAt: validLastRefresh.toISOString(),
    hoursSinceRefresh: Math.round(hoursSinceRefresh * 10) / 10,
    nextRefreshDueAt
  };
}

export async function syncSpreadsIfDue({
  db,
  apiKey,
  now = new Date(),
  fetchSpreads = fetchNflSpreads
}) {
  if (!db) throw new Error("Database is not bound");
  const nowDate = asDate(now);
  const status = await spreadRefreshStatus(db, nowDate);

  if (!status.due) {
    return {
      apiCalled: false,
      reason: status.reason,
      quota: null,
      status,
      ingestion: null
    };
  }

  if (!apiKey) throw new Error("ODDS_API_KEY is not configured");

  const result = await fetchSpreads({ apiKey });
  const ingestion = await ingestWeeklySpreads(db, result.games, nowDate);

  return {
    apiCalled: true,
    reason: status.reason,
    quota: result.quota,
    status,
    ingestion
  };
}
