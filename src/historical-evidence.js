import { ensureHistorySchema } from "./history-schema.js";

export const HISTORICAL_EVIDENCE_RANGE = Object.freeze({
  teamStartSeason: 2023,
  startSeason: 2015,
  endSeason: 2025
});

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round1(value) {
  return value === null ? null : Math.round(value * 10) / 10;
}

function isOutdoor(roof) {
  return ["outdoors", "outdoor", "open"].includes(String(roof || "").toLowerCase());
}

function tierForSpread(spread) {
  const magnitude = Math.abs(Number(spread));
  if (!Number.isFinite(magnitude) || magnitude === 0) return null;
  if (magnitude <= 3) return "<=3";
  if (magnitude <= 7) return "<=7";
  return ">7";
}

function eventForSide(row, side) {
  const awayScore = finite(row.away_score);
  const homeScore = finite(row.home_score);
  if (awayScore === null || homeScore === null) return null;
  const spread = finite(row.spread_line);
  const margin = homeScore - awayScore;
  const isHome = side === "HOME";
  const outright = margin === 0 ? "T" : isHome ? (margin > 0 ? "W" : "L") : (margin < 0 ? "W" : "L");
  let covered = null;
  if (spread !== null) {
    if (margin === spread) covered = "P";
    else {
      const homeCovered = margin > spread;
      covered = isHome ? (homeCovered ? "W" : "L") : (homeCovered ? "L" : "W");
    }
  }
  const favorite = spread === null || spread === 0 ? null : isHome ? spread > 0 : spread < 0;
  const classification = favorite === null
    ? null
    : isHome ? (favorite ? "HomeFav" : "HomeDog") : (favorite ? "AwayFav" : "AwayDog");
  const ownRest = finite(isHome ? row.home_rest : row.away_rest);
  const opponentRest = finite(isHome ? row.away_rest : row.home_rest);
  return {
    season: Number(row.season),
    week: Number(row.week),
    team: String(isHome ? row.home_team : row.away_team),
    coach: String(isHome ? row.home_coach || "" : row.away_coach || ""),
    side,
    outright,
    covered,
    favorite,
    classification,
    tier: tierForSpread(spread),
    division: Number(row.div_game) === 1,
    primeTime: Number(row.prime_time) === 1,
    shortRest: ownRest !== null && ownRest <= 6,
    extraRest: ownRest !== null && ownRest >= 8,
    restAdvantage3Plus: ownRest !== null && opponentRest !== null && ownRest - opponentRest >= 3,
    coldOutdoor: isOutdoor(row.roof) && finite(row.temp_f) !== null && finite(row.temp_f) <= 32,
    hotOutdoor: isOutdoor(row.roof) && finite(row.temp_f) !== null && finite(row.temp_f) >= 90,
    windyOutdoor: isOutdoor(row.roof) && finite(row.wind_mph) !== null && finite(row.wind_mph) >= 15
  };
}

function summarize(events) {
  let wins = 0, losses = 0, ties = 0, covers = 0, noCovers = 0, pushes = 0;
  for (const event of events) {
    if (event.outright === "W") wins += 1;
    else if (event.outright === "L") losses += 1;
    else if (event.outright === "T") ties += 1;
    if (event.covered === "W") covers += 1;
    else if (event.covered === "L") noCovers += 1;
    else if (event.covered === "P") pushes += 1;
  }
  const decisions = wins + losses;
  const spreadDecisions = covers + noCovers;
  return {
    games: events.length,
    record: { wins, losses, ties, winPct: decisions ? round1(wins / decisions * 100) : null },
    spreadRecord: { covers, noCovers, pushes, coverPct: spreadDecisions ? round1(covers / spreadDecisions * 100) : null }
  };
}

const CONDITION_KEYS = [
  "home", "away", "favorite", "underdog", "division", "primeTime",
  "shortRest", "extraRest", "restAdvantage3Plus", "coldOutdoor", "hotOutdoor", "windyOutdoor"
];

function matchesCondition(event, key) {
  if (key === "home") return event.side === "HOME";
  if (key === "away") return event.side === "AWAY";
  if (key === "favorite") return event.favorite === true;
  if (key === "underdog") return event.favorite === false;
  return event[key] === true;
}

export function historicalSubjectSummary(events, subject, subjectType) {
  const rows = Array.isArray(events) ? events : [];
  const categoryTier = {};
  for (const event of rows) {
    if (!event.classification || !event.tier) continue;
    const key = `${event.classification}|${event.tier}`;
    if (!categoryTier[key]) categoryTier[key] = [];
    categoryTier[key].push(event);
  }
  const seasons = rows.map((event) => Number(event.season)).filter(Number.isFinite);
  return {
    subject,
    subjectType,
    timeframe: seasons.length ? { fromSeason: Math.min(...seasons), toSeason: Math.max(...seasons) } : null,
    overall: summarize(rows),
    categoryTier: Object.fromEntries(Object.entries(categoryTier).map(([key, matches]) => [key, summarize(matches)])),
    conditions: Object.fromEntries(CONDITION_KEYS.map((key) => [key, summarize(rows.filter((event) => matchesCondition(event, key)))]))
  };
}

export function buildHistoricalEvidenceSummaries(rows, range = HISTORICAL_EVIDENCE_RANGE) {
  const teamEvents = new Map();
  const coachEvents = new Map();
  const leagueEvents = [];
  const startSeason = Number(range.startSeason);
  const endSeason = Number(range.endSeason);
  const teamStartSeason = Number(range.teamStartSeason);

  for (const row of Array.isArray(rows) ? rows : []) {
    const season = Number(row.season);
    if (!Number.isInteger(season) || season < startSeason || season > endSeason) continue;
    for (const side of ["AWAY", "HOME"]) {
      const event = eventForSide(row, side);
      if (!event) continue;
      leagueEvents.push(event);
      if (season >= teamStartSeason) {
        if (!teamEvents.has(event.team)) teamEvents.set(event.team, []);
        teamEvents.get(event.team).push(event);
      }
      if (event.coach) {
        if (!coachEvents.has(event.coach)) coachEvents.set(event.coach, []);
        coachEvents.get(event.coach).push(event);
      }
    }
  }

  return {
    teams: new Map([...teamEvents].map(([team, events]) => [team, historicalSubjectSummary(events, team, "TEAM")])),
    coaches: new Map([...coachEvents].map(([coach, events]) => [coach, historicalSubjectSummary(events, coach, "COACH")])),
    league: historicalSubjectSummary(leagueEvents, "NFL", "LEAGUE")
  };
}

async function storeSummaries(db, summaries, range) {
  await db.prepare(`DELETE FROM historical_evidence_summaries`).run();
  const statements = [];
  const add = (subjectType, subjectKey, startSeason, endSeason, summary) => {
    statements.push(db.prepare(`INSERT INTO historical_evidence_summaries(subject_type,subject_key,start_season,end_season,summary_json,rebuilt_at)
      VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(subjectType, subjectKey, startSeason, endSeason, JSON.stringify(summary)));
  };
  for (const [team, summary] of summaries.teams) add("TEAM", team, range.teamStartSeason, range.endSeason, summary);
  for (const [coach, summary] of summaries.coaches) add("COACH", coach, range.startSeason, range.endSeason, summary);
  add("LEAGUE", "NFL", range.startSeason, range.endSeason, summaries.league);
  for (let index = 0; index < statements.length; index += 40) await db.batch(statements.slice(index, index + 40));
  return { teamsCached: summaries.teams.size, coachesCached: summaries.coaches.size, leagueCached: 1 };
}

export async function rebuildHistoricalEvidenceSummaries(db, range = HISTORICAL_EVIDENCE_RANGE) {
  if (!db) throw new Error("Database is not bound");
  await ensureHistorySchema(db);
  const result = await db.prepare(`SELECT season,week,away_team,home_team,away_score,home_score,spread_line,roof,temp_f,wind_mph,away_rest,home_rest,away_coach,home_coach,div_game,prime_time
    FROM historical_games WHERE season BETWEEN ? AND ? AND game_type='REG' ORDER BY season,week`)
    .bind(range.startSeason, range.endSeason).all();
  const rows = result.results ?? [];
  const summaries = buildHistoricalEvidenceSummaries(rows, range);
  const stored = await storeSummaries(db, summaries, range);
  return { gamesReadOnce: rows.length, ...stored, ...range };
}

async function readStoredSummaries(db, range) {
  const result = await db.prepare(`SELECT subject_type,subject_key,summary_json,rebuilt_at FROM historical_evidence_summaries
    WHERE (subject_type='TEAM' AND start_season=? AND end_season=?)
       OR (subject_type IN ('COACH','LEAGUE') AND start_season=? AND end_season=?)`)
    .bind(range.teamStartSeason, range.endSeason, range.startSeason, range.endSeason).all();
  const teams = new Map(), coaches = new Map();
  let league = null, rebuiltAt = null;
  for (const row of result.results ?? []) {
    let summary;
    try { summary = JSON.parse(row.summary_json); } catch { continue; }
    if (row.subject_type === "TEAM") teams.set(row.subject_key, summary);
    else if (row.subject_type === "COACH") coaches.set(row.subject_key, summary);
    else if (row.subject_type === "LEAGUE") league = summary;
    if (!rebuiltAt || String(row.rebuilt_at) > rebuiltAt) rebuiltAt = row.rebuilt_at;
  }
  return { teams, coaches, league, rebuiltAt };
}

export async function loadHistoricalEvidenceSummaries(db, range = HISTORICAL_EVIDENCE_RANGE) {
  if (!db) throw new Error("Database is not bound");
  await ensureHistorySchema(db);
  let stored = await readStoredSummaries(db, range);
  if (!stored.league) {
    const rebuilt = await rebuildHistoricalEvidenceSummaries(db, range);
    stored = await readStoredSummaries(db, range);
    return { ...stored, cache: { hit: false, autoBuilt: true, ...rebuilt } };
  }
  return { ...stored, cache: { hit: true, autoBuilt: false, rebuiltAt: stored.rebuiltAt } };
}
