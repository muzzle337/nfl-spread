import { median } from "./consensus.js";
import { ensureMarketSchema } from "./market-schema.js";

function validTime(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function isPregameSnapshot(capturedAt, kickoffAt) {
  const captured = validTime(capturedAt);
  const kickoff = validTime(kickoffAt);
  return captured !== null && kickoff !== null && captured < kickoff;
}

function firstAndLastBySource(rows) {
  const ordered = (Array.isArray(rows) ? rows : []).slice().sort((a, b) => Number(a.id) - Number(b.id));
  const first = new Map();
  const last = new Map();
  for (const row of ordered) {
    const source = String(row.source ?? "");
    if (!source) continue;
    if (!first.has(source)) first.set(source, row);
    last.set(source, row);
  }
  return { first:[...first.values()], last:[...last.values()] };
}

export function summarizePregameSpreadRows(rows) {
  const { first, last } = firstAndLastBySource(rows);
  return {
    openingAwaySpread: median(first.map((row) => row.away_spread)),
    latestAwaySpread: median(last.map((row) => row.away_spread)),
    bookmakerCount: last.length,
    snapshotCount: Array.isArray(rows) ? rows.length : 0
  };
}

export async function reconcileGamePregameMarkets(db, gameId) {
  const game = await db.prepare(`SELECT id,status,kickoff_at,opening_away_spread,current_away_spread,closing_away_spread
    FROM games WHERE id=? LIMIT 1`).bind(gameId).first();
  if (!game) return null;
  const result = await db.prepare(`SELECT id,source,away_spread,captured_at FROM line_snapshots
    WHERE game_id=? AND julianday(captured_at) < julianday(?) ORDER BY id`).bind(gameId,game.kickoff_at).all();
  const summary = summarizePregameSpreadRows(result.results ?? []);
  const completed = String(game.status).toUpperCase() === "COMPLETED";
  const closing = completed ? summary.latestAwaySpread : null;
  await db.prepare(`UPDATE games SET opening_away_spread=?,current_away_spread=?,closing_away_spread=?,updated_at=CURRENT_TIMESTAMP
    WHERE id=?`).bind(summary.openingAwaySpread,summary.latestAwaySpread,closing,gameId).run();
  return {
    gameId,
    status:game.status,
    openingAwaySpread:summary.openingAwaySpread,
    currentPregameAwaySpread:summary.latestAwaySpread,
    closingAwaySpread:closing,
    validPregameSnapshots:summary.snapshotCount,
    bookmakerCount:summary.bookmakerCount
  };
}

export async function reconcilePregameMarkets(db, { season, week = null } = {}) {
  if (!db) throw new Error("Database is not bound");
  await ensureMarketSchema(db);
  const year = Number(season);
  const weekNumber = week === null ? null : Number(week);
  if (!Number.isInteger(year)) throw new Error("season is required");
  if (week !== null && !Number.isInteger(weekNumber)) throw new Error("week must be an integer");
  const result = weekNumber === null
    ? await db.prepare(`SELECT id FROM games WHERE season=? AND season_type='REGULAR' ORDER BY week,kickoff_at,id`).bind(year).all()
    : await db.prepare(`SELECT id FROM games WHERE season=? AND week=? AND season_type='REGULAR' ORDER BY kickoff_at,id`).bind(year,weekNumber).all();
  const games = [];
  for (const row of result.results ?? []) games.push(await reconcileGamePregameMarkets(db,row.id));
  return {
    season:year,
    week:weekNumber,
    gamesReconciled:games.length,
    gamesWithoutPregameSpread:games.filter((game) => game?.closingAwaySpread === null && String(game?.status).toUpperCase() === "COMPLETED").length,
    games,
    oddsApiCalled:false,
    postKickoffSnapshotsDeleted:0
  };
}
