import { projectionsForWeek } from "./projection.js";
import { weekResultsStatus } from "./result-sync.js";
import { settleAgainstSpread } from "./engine.js";
import { seasonTierPulse } from "./tier-contributors.js";
import { dedupeCanonicalMatchups } from "./team-codes.js";
import { buildTrendWatch } from "./trend-watch.js";

const DASHBOARD_CACHE_SCHEMA_VERSION = 1;

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function tierBucket(stats, classification, tier) {
  if (!classification || !tier) return null;
  return stats?.buckets?.[`${classification}|${tier}`] ?? null;
}

function postgameAnalysis(game, final, liveWeekStats) {
  if (!final || !game?.classification) return null;
  const awaySpread = finiteNumber(game.medianAwaySpread);
  const homeSpread = finiteNumber(game.medianHomeSpread);
  const awayScore = finiteNumber(final.awayScore);
  const homeScore = finiteNumber(final.homeScore);
  if ([awaySpread, homeSpread, awayScore, homeScore].some((value) => value === null)) return null;
  let settlement;
  try { settlement = settleAgainstSpread({ awaySpread, homeSpread, awayScore, homeScore }); }
  catch { return null; }
  const tier = game.classification.tier;
  if (settlement.coveringSide === "Push") {
    return { spreadResult:"PUSH",coveringSide:"PUSH",coveringTeam:null,classification:null,tier,liveBucket:tierBucket(liveWeekStats,game.classification.away,tier) };
  }
  const awayCovered = settlement.coveringSide === "Away";
  const classification = awayCovered ? game.classification.away : game.classification.home;
  return { spreadResult:"COVER",coveringSide:awayCovered?"AWAY":"HOME",coveringTeam:awayCovered?game.awayTeam:game.homeTeam,classification,tier,liveBucket:tierBucket(liveWeekStats,classification,tier) };
}

export async function resolveDashboardWeek(db) {
  if (!db) throw new Error("Database is not bound");
  const latest = await db.prepare(`SELECT MAX(season) AS season FROM games WHERE season_type='REGULAR'`).first();
  if (latest?.season === null || latest?.season === undefined || latest?.season === "") return {season:null,week:null};
  const season=Number(latest.season); if(!Number.isInteger(season)) return {season:null,week:null};
  const result=await db.prepare(`SELECT id,season,week,away_team,home_team,status,away_score,home_score FROM games WHERE season=? AND season_type='REGULAR' ORDER BY week ASC,id ASC`).bind(season).all();
  const byWeek=new Map();
  for(const row of dedupeCanonicalMatchups(result.results??[])){
    const week=Number(row.week); if(!Number.isInteger(week))continue;
    const summary=byWeek.get(week)??{week,totalGames:0,completedGames:0}; summary.totalGames+=1;
    if(row.status==="COMPLETED"&&row.away_score!=null&&row.home_score!=null)summary.completedGames+=1; byWeek.set(week,summary);
  }
  const weeks=[...byWeek.values()].sort((a,b)=>a.week-b.week); if(!weeks.length)return {season,week:null};
  const active=weeks.find(row=>row.completedGames<row.totalGames); return {season,week:(active??weeks[weeks.length-1]).week};
}

async function ensureDashboardCacheSchema(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS dashboard_snapshot_cache(
    season INTEGER NOT NULL,
    week INTEGER NOT NULL,
    schema_version INTEGER NOT NULL,
    data_signature TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    built_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(season,week)
  )`).run();
}

async function dashboardDataSignature(db,season){
  const row=await db.prepare(`
    SELECT
      (SELECT COALESCE(MAX(ls.id),0) FROM line_snapshots ls JOIN games g ON g.id=ls.game_id WHERE g.season=? AND g.season_type='REGULAR') AS line_id,
      (SELECT COALESCE(MAX(ms.id),0) FROM moneyline_snapshots ms JOIN games g ON g.id=ms.game_id WHERE g.season=? AND g.season_type='REGULAR') AS moneyline_id,
      (SELECT COUNT(*) FROM games g WHERE g.season=? AND g.season_type='REGULAR' AND g.status='COMPLETED') AS completed,
      (SELECT COALESCE(SUM(COALESCE(g.away_score,0)+COALESCE(g.home_score,0)),0) FROM games g WHERE g.season=? AND g.season_type='REGULAR') AS score_sum,
      (SELECT COUNT(*) FROM games g WHERE g.season=? AND g.season_type='REGULAR' AND g.status='LIVE') AS live_count
  `).bind(season,season,season,season,season).first();
  return [row?.line_id??0,row?.moneyline_id??0,row?.completed??0,row?.score_sum??0,row?.live_count??0].join(':');
}

async function buildDashboardSnapshot(db,now,target){
  const [projection,results,seasonPulse]=await Promise.all([
    projectionsForWeek(db,target.season,target.week),
    weekResultsStatus(db,target.season,target.week,now),
    seasonTierPulse(db,target.season)
  ]);
  const resultById=new Map((results.games??[]).map(game=>[String(game.id),game]));
  const games=(projection.games??[]).map(game=>{
    const result=resultById.get(String(game.id)),isFinal=Boolean(result?.final),awayScore=finiteNumber(result?.awayScore),homeScore=finiteNumber(result?.homeScore);
    const final=isFinal?{awayScore,homeScore}:null;
    const live=!isFinal&&result?.status==="LIVE"&&awayScore!==null&&homeScore!==null?{awayScore,homeScore}:null;
    return {...game,status:result?.status??game.status??null,final,live,postgame:postgameAnalysis(game,final,projection.liveWeekStats)};
  });
  return {...projection,seasonPulse,trendWatch:buildTrendWatch(seasonPulse,games),games,results};
}

export async function dashboardSnapshot(db, now = new Date(), selected = null) {
  const requestedSeason=Number(selected?.season),requestedWeek=Number(selected?.week);
  const target=Number.isInteger(requestedSeason)&&Number.isInteger(requestedWeek)&&requestedWeek>0?{season:requestedSeason,week:requestedWeek}:await resolveDashboardWeek(db);
  if(target.season===null||target.week===null)return {season:target.season,week:target.week,gameCount:0,focusCount:0,games:[],results:null,cache:{hit:false}};
  await ensureDashboardCacheSchema(db);
  const signature=await dashboardDataSignature(db,target.season);
  const cached=await db.prepare(`SELECT schema_version,data_signature,payload_json,built_at FROM dashboard_snapshot_cache WHERE season=? AND week=? LIMIT 1`).bind(target.season,target.week).first();
  if(Number(cached?.schema_version)===DASHBOARD_CACHE_SCHEMA_VERSION&&cached?.data_signature===signature&&cached?.payload_json){
    try{return {...JSON.parse(cached.payload_json),cache:{hit:true,builtAt:cached.built_at,signature}}}catch{}
  }
  const payload=await buildDashboardSnapshot(db,now,target);
  await db.prepare(`INSERT INTO dashboard_snapshot_cache(season,week,schema_version,data_signature,payload_json,built_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(season,week) DO UPDATE SET schema_version=excluded.schema_version,data_signature=excluded.data_signature,payload_json=excluded.payload_json,built_at=CURRENT_TIMESTAMP`)
    .bind(target.season,target.week,DASHBOARD_CACHE_SCHEMA_VERSION,signature,JSON.stringify(payload)).run();
  return {...payload,cache:{hit:false,builtAt:new Date().toISOString(),signature}};
}
