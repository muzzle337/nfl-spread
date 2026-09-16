import { fetchNflverseSeason, teamCode } from "./context-sources.js";
import { dedupeCanonicalMatchups } from "./team-codes.js";

function clean(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function easternOffset(dateText) {
  const date = new Date(`${dateText}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "-04:00";
  const year = date.getUTCFullYear();
  const novemberFirst = new Date(Date.UTC(year, 10, 1));
  const firstSunday = 1 + ((7 - novemberFirst.getUTCDay()) % 7);
  return date.getUTCMonth() > 10 || (date.getUTCMonth() === 10 && date.getUTCDate() >= firstSunday) || date.getUTCMonth() < 2
    ? "-05:00"
    : "-04:00";
}

export function scheduleKickoff(row) {
  const gameday = clean(row.gameday || row.game_date || row.date);
  const gametime = clean(row.gametime || row.game_time || row.time);
  if (!gameday) return null;
  const value = `${gameday}T${gametime || "12:00"}:00${easternOffset(gameday)}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function normalizeSeasonSchedule(rows, season) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const week = Number(row.week);
    const awayTeam = teamCode(row.away_team || row.awayTeam);
    const homeTeam = teamCode(row.home_team || row.homeTeam);
    if (!Number.isInteger(week) || week < 1 || week > 18 || !awayTeam || !homeTeam) return null;
    return {
      id: clean(row.game_id || row.id) || `schedule-${season}-${week}-${awayTeam}-${homeTeam}`,
      season: Number(season),
      week,
      awayTeam,
      homeTeam,
      kickoffAt: scheduleKickoff(row)
    };
  }).filter(Boolean);
}

export async function importSeasonSchedule(db, season, { fetchImpl = fetch } = {}) {
  if (!db) throw new Error("Database is not bound");
  const year = Number(season);
  if (!Number.isInteger(year)) throw new Error("Season must be an integer");
  const rows = normalizeSeasonSchedule(await fetchNflverseSeason(year, fetchImpl), year);
  if (!rows.length) throw new Error(`No regular-season schedule rows were found for ${year}`);
  let inserted = 0;
  let matched = 0;
  for (const game of rows) {
    const existingRows = await db.prepare(`
      SELECT id,away_team,home_team FROM games
      WHERE season=? AND week=? AND season_type='REGULAR'
    `).bind(game.season, game.week).all();
    const matching = (existingRows.results ?? []).filter((row) =>
      teamCode(row.away_team) === game.awayTeam && teamCode(row.home_team) === game.homeTeam
    );
    const existing = dedupeCanonicalMatchups(matching.map((row)=>({...row,season:game.season,week:game.week})))[0] || null;
    const id = existing?.id || game.id;
    await db.prepare(`
      INSERT INTO games(id,season,week,season_type,away_team,home_team,kickoff_at,status,updated_at)
      VALUES(?,?,?,'REGULAR',?,?,?,'SCHEDULED',CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        season=excluded.season,week=excluded.week,season_type='REGULAR',
        away_team=excluded.away_team,home_team=excluded.home_team,
        kickoff_at=COALESCE(excluded.kickoff_at,games.kickoff_at),updated_at=CURRENT_TIMESTAMP
    `).bind(id, game.season, game.week, existing?.away_team || game.awayTeam, existing?.home_team || game.homeTeam, game.kickoffAt).run();
    if (existing) matched += 1;
    else inserted += 1;
  }
  return { season: year, games: rows.length, inserted, matched, weeks: [...new Set(rows.map((row) => row.week))].length, paidApiCredits: 0 };
}
