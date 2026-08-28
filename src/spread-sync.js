import { ingestWeeklySpreads } from "./ingestion.js";
import { fetchNflSpreads } from "./odds.js";

const HOUR_MS = 60 * 60 * 1000;
const NEXT_WEEK_DISCOVERY_WINDOW_HOURS = 8 * 24;
const NEXT_WEEK_DISCOVERY_INTERVAL_HOURS = 24;

export const SPREAD_REFRESH_CRON = "35 * * * *";

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

function roundedHours(value) {
  return Math.round(value * 10) / 10;
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

async function latestKnownRegularGame(db) {
  return db.prepare(`
    SELECT id, season, week, away_team, home_team, kickoff_at
    FROM games
    WHERE season_type = 'REGULAR'
    ORDER BY julianday(kickoff_at) DESC, id DESC
    LIMIT 1
  `).first();
}

async function lastSuccessfulSpreadIngestion(db) {
  return db.prepare(`
    SELECT
      request_type,
      strftime('%Y-%m-%dT%H:%M:%SZ', requested_at) AS requested_at_iso
    FROM api_usage
    WHERE provider = 'the-odds-api'
      AND success = 1
      AND request_type IN ('nfl_ingest', 'nfl_auto_spreads')
    ORDER BY id DESC
    LIMIT 1
  `).first();
}

function lastRefreshInfo(latest, nowDate) {
  const parsed = latest?.requested_at_iso ? new Date(latest.requested_at_iso) : null;
  const lastRefresh = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  if (!lastRefresh) {
    return {
      lastRefresh: null,
      hoursSinceRefresh: null
    };
  }

  return {
    lastRefresh,
    hoursSinceRefresh: Math.max(0, (nowDate.getTime() - lastRefresh.getTime()) / HOUR_MS)
  };
}

function gameSummary(game) {
  if (!game) return null;
  return {
    id: game.id,
    season: Number(game.season),
    week: Number(game.week),
    awayTeam: game.away_team,
    homeTeam: game.home_team,
    kickoffAt: game.kickoff_at
  };
}

export async function spreadRefreshStatus(db, now = new Date()) {
  if (!db) throw new Error("Database is not bound");
  const nowDate = asDate(now);
  const [game, latest] = await Promise.all([
    nextUpcomingGame(db, nowDate),
    lastSuccessfulSpreadIngestion(db)
  ]);
  const { lastRefresh, hoursSinceRefresh } = lastRefreshInfo(latest, nowDate);

  if (game) {
    const kickoff = asDate(game.kickoff_at);
    const hoursToKickoff = Math.max(0, (kickoff.getTime() - nowDate.getTime()) / HOUR_MS);
    const refreshIntervalHours = spreadRefreshIntervalHours(hoursToKickoff);

    if (!lastRefresh) {
      return {
        checkedAt: nowDate.toISOString(),
        due: true,
        reason: "NEVER_REFRESHED",
        discoveryMode: false,
        nextGame: gameSummary(game),
        latestKnownGame: gameSummary(game),
        hoursToKickoff: roundedHours(hoursToKickoff),
        refreshIntervalHours,
        lastSuccessfulRefreshAt: null,
        hoursSinceRefresh: null,
        nextRefreshDueAt: nowDate.toISOString()
      };
    }

    const due = hoursSinceRefresh >= refreshIntervalHours;
    return {
      checkedAt: nowDate.toISOString(),
      due,
      reason: due ? "REFRESH_DUE" : "FRESH_ENOUGH",
      discoveryMode: false,
      nextGame: gameSummary(game),
      latestKnownGame: gameSummary(game),
      hoursToKickoff: roundedHours(hoursToKickoff),
      refreshIntervalHours,
      lastSuccessfulRefreshAt: lastRefresh.toISOString(),
      hoursSinceRefresh: roundedHours(hoursSinceRefresh),
      nextRefreshDueAt: new Date(lastRefresh.getTime() + refreshIntervalHours * HOUR_MS).toISOString()
    };
  }

  const latestKnown = await latestKnownRegularGame(db);
  if (!latestKnown) {
    return {
      checkedAt: nowDate.toISOString(),
      due: false,
      reason: "NO_STORED_GAMES",
      discoveryMode: false,
      nextGame: null,
      latestKnownGame: null,
      hoursToKickoff: null,
      refreshIntervalHours: null,
      lastSuccessfulRefreshAt: lastRefresh?.toISOString() ?? null,
      hoursSinceRefresh: hoursSinceRefresh === null ? null : roundedHours(hoursSinceRefresh),
      nextRefreshDueAt: null
    };
  }

  const latestKickoff = asDate(latestKnown.kickoff_at);
  const hoursSinceLatestKickoff = (nowDate.getTime() - latestKickoff.getTime()) / HOUR_MS;
  const insideDiscoveryWindow = hoursSinceLatestKickoff >= 0
    && hoursSinceLatestKickoff <= NEXT_WEEK_DISCOVERY_WINDOW_HOURS;

  if (!insideDiscoveryWindow) {
    return {
      checkedAt: nowDate.toISOString(),
      due: false,
      reason: "NO_UPCOMING_GAMES",
      discoveryMode: false,
      nextGame: null,
      latestKnownGame: gameSummary(latestKnown),
      hoursToKickoff: null,
      hoursSinceLatestKickoff: roundedHours(hoursSinceLatestKickoff),
      refreshIntervalHours: null,
      lastSuccessfulRefreshAt: lastRefresh?.toISOString() ?? null,
      hoursSinceRefresh: hoursSinceRefresh === null ? null : roundedHours(hoursSinceRefresh),
      nextRefreshDueAt: null
    };
  }

  const due = !lastRefresh || hoursSinceRefresh >= NEXT_WEEK_DISCOVERY_INTERVAL_HOURS;
  return {
    checkedAt: nowDate.toISOString(),
    due,
    reason: due ? "DISCOVER_NEXT_WEEK" : "WAITING_TO_DISCOVER_NEXT_WEEK",
    discoveryMode: true,
    nextGame: null,
    latestKnownGame: gameSummary(latestKnown),
    hoursToKickoff: null,
    hoursSinceLatestKickoff: roundedHours(hoursSinceLatestKickoff),
    refreshIntervalHours: NEXT_WEEK_DISCOVERY_INTERVAL_HOURS,
    lastSuccessfulRefreshAt: lastRefresh?.toISOString() ?? null,
    hoursSinceRefresh: hoursSinceRefresh === null ? null : roundedHours(hoursSinceRefresh),
    nextRefreshDueAt: lastRefresh
      ? new Date(lastRefresh.getTime() + NEXT_WEEK_DISCOVERY_INTERVAL_HOURS * HOUR_MS).toISOString()
      : nowDate.toISOString()
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
