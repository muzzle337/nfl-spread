import snapshot from "./situational-history-data.json" with { type: "json" };
import { ensureHistorySchema } from "./history-schema.js";

export const SITUATIONAL_HISTORY_KEY = "nflverse-pbp-2023-2025-v1";

const LABELS = Object.freeze({
  trailingHalftime: "When trailing at halftime",
  leadingHalftime: "When leading at halftime",
  trailingEnteringQ4: "When trailing entering Q4",
  leadingEnteringQ4: "When leading entering Q4",
  closeEnteringQ4: "Within 7 points entering Q4",
  oneScoreGame: "One-score games",
  trailedBy7Plus: "After trailing by 7+"
});

const FAVORITE_CONDITIONS = ["leadingHalftime", "leadingEnteringQ4", "closeEnteringQ4", "oneScoreGame"];
const UNDERDOG_CONDITIONS = ["trailingHalftime", "trailingEnteringQ4", "trailedBy7Plus", "closeEnteringQ4", "oneScoreGame"];
const UNCLASSIFIED_CONDITIONS = ["closeEnteringQ4", "oneScoreGame"];

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function loadSituationalHistory(db) {
  if (!db) throw new Error("Database is not bound");
  await ensureHistorySchema(db);
  const stored = await db.prepare(`SELECT payload_json,rebuilt_at FROM situational_history_cache WHERE snapshot_key=? LIMIT 1`)
    .bind(SITUATIONAL_HISTORY_KEY).first();
  if (stored?.payload_json) {
    try { return { ...JSON.parse(stored.payload_json), cache:{ hit:true, rebuiltAt:stored.rebuilt_at } }; } catch {}
  }
  await db.prepare(`INSERT INTO situational_history_cache(snapshot_key,payload_json,rebuilt_at) VALUES(?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(snapshot_key) DO UPDATE SET payload_json=excluded.payload_json,rebuilt_at=CURRENT_TIMESTAMP`)
    .bind(SITUATIONAL_HISTORY_KEY,JSON.stringify(snapshot)).run();
  return { ...snapshot, cache:{ hit:false, autoBuilt:true, source:"bundled_nflverse_aggregate" } };
}

function sideClassification(game, side) {
  return String(game?.classification?.[side] ?? "");
}

function candidate(snapshotData, team, projectedCode, condition, priority) {
  const record = snapshotData?.teams?.[team]?.[condition];
  const baseline = snapshotData?.league?.[condition];
  const games = Number(record?.games || 0);
  const winPct = finite(record?.winPct);
  const baselineWinPct = finite(baseline?.winPct);
  if (games < 5 || winPct === null || baselineWinPct === null) return null;
  const difference = Math.round((winPct - baselineWinPct) * 10) / 10;
  let relationship = "NEUTRAL";
  if (projectedCode && Math.abs(difference) >= 5) {
    const teamPerformsBetter = difference > 0;
    relationship = (team === projectedCode) === teamPerformsBetter ? "SUPPORTS" : "CONFLICTS";
  }
  return {
    team,
    condition,
    label: LABELS[condition] || condition,
    definition: snapshotData?.definitions?.[condition] || null,
    record: { wins:Number(record.wins||0), losses:Number(record.losses||0), ties:Number(record.ties||0) },
    winPct,
    games,
    timeframe: snapshotData.timeframe,
    baseline: { games:Number(baseline.games||0), winPct:baselineWinPct },
    differenceFromBaseline:difference,
    relationship,
    priority:priority + (team === projectedCode ? 2 : 0),
    outcomeType:"OUTRIGHT"
  };
}

export function situationalEvidenceForGame(game, snapshotData = snapshot) {
  const projectedCode = game?.projectedCode || null;
  const byTeam = [];
  for (const side of ["away", "home"]) {
    const team = side === "away" ? game.awayCode : game.homeCode;
    const classification = sideClassification(game, side);
    const conditions = classification.includes("Fav") ? FAVORITE_CONDITIONS
      : classification.includes("Dog") ? UNDERDOG_CONDITIONS
      : UNCLASSIFIED_CONDITIONS;
    const candidates = conditions.map((condition,index) => candidate(snapshotData,team,projectedCode,condition,100-index*8)).filter(Boolean)
      .sort((a,b)=>b.priority-a.priority||Math.abs(b.differenceFromBaseline)-Math.abs(a.differenceFromBaseline));
    if (candidates[0]) byTeam.push(candidates[0]);
  }
  return byTeam.sort((a,b)=>b.priority-a.priority||Math.abs(b.differenceFromBaseline)-Math.abs(a.differenceFromBaseline))
    .slice(0,2).map(({priority,...item})=>item);
}

export function situationalSummary(items) {
  const evidence = Array.isArray(items) ? items : [];
  return {
    supports:evidence.filter((item)=>item.relationship==="SUPPORTS").length,
    conflicts:evidence.filter((item)=>item.relationship==="CONFLICTS").length,
    neutral:evidence.filter((item)=>item.relationship==="NEUTRAL").length
  };
}
