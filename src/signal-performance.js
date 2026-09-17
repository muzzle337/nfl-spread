import { settleAgainstSpread } from "./engine.js";

export const SIGNAL_DEFINITIONS = Object.freeze([
  { id:"TIER_EDGE", label:"Tier edge", metric:"ATS" },
  { id:"MARKET_ALIGNED", label:"Tier + market aligned", metric:"ATS" },
  { id:"HISTORICAL_SUPPORT", label:"Historical support", metric:"ATS" },
  { id:"SITUATIONAL_SUPPORT", label:"Situational support", metric:"OUTRIGHT" },
  { id:"OUTRIGHT_OUTLOOK", label:"Outright outlook", metric:"OUTRIGHT" }
]);

const SIGNAL_IDS = new Set(SIGNAL_DEFINITIONS.map((row) => row.id));

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function movementTeam(game) {
  if (game?.movement?.direction === "TOWARD_AWAY") return game.awayTeam;
  if (game?.movement?.direction === "TOWARD_HOME") return game.homeTeam;
  return null;
}

function projectedClassification(game) {
  if (!game?.classification || !game?.spread?.projectedTeam) return null;
  if (game.spread.projectedTeam === game.awayTeam) return game.classification.away ?? null;
  if (game.spread.projectedTeam === game.homeTeam) return game.classification.home ?? null;
  return null;
}

export function signalSnapshotForGame(game) {
  const projectedTeam = game?.spread?.projectedTeam ?? null;
  return {
    gameId:String(game?.gameId ?? game?.id ?? ""),
    awayTeam:game?.awayTeam ?? null,
    homeTeam:game?.homeTeam ?? null,
    kickoffAt:game?.kickoffAt ?? null,
    projectedTeam,
    projectedClassification:projectedClassification(game),
    tier:game?.classification?.tier ?? null,
    coverRate:finite(game?.spread?.coverRate),
    grade:game?.spread?.grade ?? null,
    spread:{away:finite(game?.spread?.away),home:finite(game?.spread?.home)},
    market:{
      alignment:game?.movement?.marketAlignment ?? null,
      movementTeam:movementTeam(game)
    },
    historical:{
      supports:count(game?.history?.evidenceSummary?.supports),
      conflicts:count(game?.history?.evidenceSummary?.conflicts)
    },
    situational:{
      supports:count(game?.history?.situationalSummary?.supports),
      conflicts:count(game?.history?.situationalSummary?.conflicts)
    },
    outrightTeam:game?.outlook?.team ?? null
  };
}

export async function ensureSignalPerformanceSchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS game_signal_snapshots(
    game_id TEXT PRIMARY KEY,
    season INTEGER NOT NULL,
    week INTEGER NOT NULL,
    kickoff_at TEXT,
    payload_json TEXT NOT NULL,
    captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_signal_snapshots_season_week
    ON game_signal_snapshots(season,week)`).run();
}

export async function capturePregameSignalSnapshots(db, season, week, games, now = new Date()) {
  await ensureSignalPerformanceSchema(db);
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  let captured = 0;
  let skippedStarted = 0;
  let skippedEmpty = 0;
  for (const game of Array.isArray(games) ? games : []) {
    const snapshot = signalSnapshotForGame(game);
    const kickoffMs = new Date(snapshot.kickoffAt).getTime();
    if (!snapshot.gameId || !Number.isFinite(kickoffMs)) {
      skippedEmpty += 1;
      continue;
    }
    if (kickoffMs <= nowMs) {
      skippedStarted += 1;
      continue;
    }
    await db.prepare(`INSERT INTO game_signal_snapshots(game_id,season,week,kickoff_at,payload_json,captured_at)
      VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(game_id) DO UPDATE SET
        season=excluded.season,week=excluded.week,kickoff_at=excluded.kickoff_at,
        payload_json=excluded.payload_json,captured_at=CURRENT_TIMESTAMP`)
      .bind(snapshot.gameId,Number(season),Number(week),snapshot.kickoffAt,JSON.stringify(snapshot)).run();
    captured += 1;
  }
  return { captured, skippedStarted, skippedEmpty };
}

function signalInstances(snapshot) {
  const projectedTeam = snapshot?.projectedTeam ?? null;
  const grade = snapshot?.grade ?? null;
  const rate = finite(snapshot?.coverRate);
  const qualified = Boolean(projectedTeam && grade && rate !== null && rate >= 55);
  const rows = [];
  if (qualified) rows.push({ signal:"TIER_EDGE", team:projectedTeam, metric:"ATS" });
  if (qualified && snapshot?.market?.alignment === "ALIGNED" && snapshot.market.movementTeam === projectedTeam) {
    rows.push({ signal:"MARKET_ALIGNED", team:projectedTeam, metric:"ATS" });
  }
  if (qualified && count(snapshot?.historical?.supports)) {
    rows.push({ signal:"HISTORICAL_SUPPORT", team:projectedTeam, metric:"ATS" });
  }
  if (qualified && count(snapshot?.situational?.supports)) {
    rows.push({ signal:"SITUATIONAL_SUPPORT", team:projectedTeam, metric:"OUTRIGHT" });
  }
  if (snapshot?.outrightTeam) rows.push({ signal:"OUTRIGHT_OUTLOOK", team:snapshot.outrightTeam, metric:"OUTRIGHT" });
  return rows;
}

function outrightOutcome(row, team) {
  if (row.status !== "COMPLETED" || finite(row.away_score) === null || finite(row.home_score) === null) return "PENDING";
  const awayScore = Number(row.away_score), homeScore = Number(row.home_score);
  if (awayScore === homeScore) return "PUSH";
  return team === (awayScore > homeScore ? row.away_team : row.home_team) ? "WIN" : "LOSS";
}

function atsOutcome(row, snapshot, team) {
  if (row.status !== "COMPLETED" || finite(row.away_score) === null || finite(row.home_score) === null) return "PENDING";
  const awaySpread = finite(row.away_spread) ?? finite(snapshot?.spread?.away);
  if (awaySpread === null) return "PENDING";
  let settlement;
  try {
    settlement = settleAgainstSpread({
      awaySpread,
      homeSpread:awaySpread === 0 ? 0 : -awaySpread,
      awayScore:Number(row.away_score),
      homeScore:Number(row.home_score)
    });
  } catch {
    return "PENDING";
  }
  if (settlement.coveringSide === "Push") return "PUSH";
  const coveringTeam = settlement.coveringSide === "Away" ? row.away_team : row.home_team;
  return team === coveringTeam ? "WIN" : "LOSS";
}

export function gradeSignalRows(rows) {
  const graded = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    let snapshot;
    try { snapshot = typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json; }
    catch { continue; }
    for (const instance of signalInstances(snapshot)) {
      const outcome = instance.metric === "ATS"
        ? atsOutcome(row,snapshot,instance.team)
        : outrightOutcome(row,instance.team);
      graded.push({
        signal:instance.signal,
        metric:instance.metric,
        team:instance.team,
        outcome,
        gameId:row.game_id,
        season:Number(row.season),
        week:Number(row.week),
        kickoffAt:row.kickoff_at,
        awayTeam:row.away_team,
        homeTeam:row.home_team,
        awayScore:finite(row.away_score),
        homeScore:finite(row.home_score),
        closingAwaySpread:finite(row.away_spread),
        capturedAt:row.captured_at,
        snapshot
      });
    }
  }
  return graded;
}

function totals(rows) {
  const wins=rows.filter((row)=>row.outcome==="WIN").length;
  const losses=rows.filter((row)=>row.outcome==="LOSS").length;
  const pushes=rows.filter((row)=>row.outcome==="PUSH").length;
  const pending=rows.filter((row)=>row.outcome==="PENDING").length;
  const decisions=wins+losses;
  return {wins,losses,pushes,pending,decisions,rate:decisions?Math.round(wins/decisions*1000)/10:null};
}

export function aggregateSignalPerformance(graded, selectedSignal = null) {
  if (selectedSignal && !SIGNAL_IDS.has(selectedSignal)) throw new Error("Unsupported signal");
  const rows = Array.isArray(graded) ? graded : [];
  const signals = SIGNAL_DEFINITIONS.map((definition) => {
    const contributors = rows.filter((row)=>row.signal===definition.id);
    const weeks = [...new Set(contributors.map((row)=>row.week))].sort((a,b)=>a-b).map((week)=>({
      week,...totals(contributors.filter((row)=>row.week===week))
    }));
    return {...definition,...totals(contributors),weeks};
  });
  return {
    signals,
    contributors:selectedSignal?rows.filter((row)=>row.signal===selectedSignal):undefined
  };
}

async function storedSignalRows(db, season) {
  await ensureSignalPerformanceSchema(db);
  const result=await db.prepare(`SELECT s.game_id,s.season,s.week,s.kickoff_at,s.payload_json,s.captured_at,
      g.away_team,g.home_team,g.status,g.away_score,g.home_score,
      COALESCE(g.closing_away_spread,g.current_away_spread,g.opening_away_spread) AS away_spread
    FROM game_signal_snapshots s
    JOIN games g ON g.id=s.game_id
    WHERE s.season=? AND g.season_type='REGULAR'
    ORDER BY s.week,g.kickoff_at,s.game_id`).bind(Number(season)).all();
  return result.results ?? [];
}

export async function signalPerformance(db, season, selectedSignal = null) {
  const year=Number(season);
  if (!Number.isInteger(year)) throw new Error("season is required");
  const rows=gradeSignalRows(await storedSignalRows(db,year));
  return {
    season:year,
    trackingStartedVersion:"0.24.0",
    snapshotCount:new Set(rows.map((row)=>row.gameId)).size,
    affectsFocus:false,
    affectsPicks:false,
    oddsApiCalled:false,
    ...aggregateSignalPerformance(rows,selectedSignal)
  };
}
