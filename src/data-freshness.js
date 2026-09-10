import { resolveDashboardWeek } from './dashboard-data.js';

function iso(v){ if(!v) return null; const d=new Date(v); return Number.isNaN(d.getTime())?null:d.toISOString(); }
function ageMinutes(v,now){ const d=iso(v); return d===null?null:Math.max(0,Math.round((now.getTime()-new Date(d).getTime())/60000)); }
function dynamicStatus(updatedAt,now,warnMinutes,staleMinutes){
  const age=ageMinutes(updatedAt,now);
  if(age===null)return{status:'UNAVAILABLE',stale:true,ageMinutes:null};
  if(age>staleMinutes)return{status:'STALE',stale:true,ageMinutes:age};
  if(age>warnMinutes)return{status:'AGING',stale:false,ageMinutes:age};
  return{status:'CURRENT',stale:false,ageMinutes:age};
}

async function firstSafe(db,sql,...args){
  try{ return await db.prepare(sql).bind(...args).first(); }catch{return null;}
}

export async function dataFreshness(db,{season=null,week=null,now=new Date()}={}){
  if(!db)throw new Error('Database is not bound');
  const target=Number.isInteger(Number(season))&&Number.isInteger(Number(week))
    ? {season:Number(season),week:Number(week)}
    : await resolveDashboardWeek(db);
  const s=target.season,w=target.week;

  const [marketRow,gameRow,contextRow,historyRow,cacheRow,resultRun,spreadRun]=await Promise.all([
    s&&w?firstSafe(db,`SELECT MAX(ls.captured_at) AS updated_at FROM line_snapshots ls JOIN games g ON g.id=ls.game_id WHERE g.season=? AND g.week=? AND g.season_type='REGULAR'`,s,w):null,
    s&&w?firstSafe(db,`SELECT MAX(updated_at) AS updated_at, SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) AS completed, COUNT(*) AS total FROM games WHERE season=? AND week=? AND season_type='REGULAR'`,s,w):null,
    firstSafe(db,`SELECT created_at,nfldata_ok,nflverse_ok,weather_ok FROM context_sync_runs ORDER BY id DESC LIMIT 1`),
    firstSafe(db,`SELECT MAX(rebuilt_at) AS updated_at, COUNT(*) AS summaries FROM historical_coach_summaries`),
    s&&w?firstSafe(db,`SELECT built_at FROM weekly_outlook_cache WHERE season=? AND week=? LIMIT 1`,s,w):null,
    firstSafe(db,`SELECT requested_at,success FROM api_usage WHERE request_type='nfl_results' ORDER BY id DESC LIMIT 1`),
    firstSafe(db,`SELECT requested_at,success FROM api_usage WHERE request_type IN ('nfl_auto_spreads','nfl_ingest','nfl_spreads') ORDER BY id DESC LIMIT 1`)
  ]);

  const marketAt=iso(marketRow?.updated_at ?? spreadRun?.requested_at);
  const scoresAt=iso(resultRun?.requested_at ?? gameRow?.updated_at);
  const contextAt=iso(contextRow?.created_at);
  const historyAt=iso(historyRow?.updated_at);
  const intelligenceAt=iso(cacheRow?.built_at);
  const completed=Number(gameRow?.completed??0),total=Number(gameRow?.total??0);

  const sources={
    scores:{updatedAt:scoresAt,...dynamicStatus(scoresAt,now,90,240),lastSuccess:resultRun?Number(resultRun.success)===1:null,completedGames:completed,totalGames:total},
    market:{updatedAt:marketAt,...dynamicStatus(marketAt,now,180,720),lastSuccess:spreadRun?Number(spreadRun.success)===1:null},
    context:{updatedAt:contextAt,...dynamicStatus(contextAt,now,720,2160),lastSuccess:contextRow?Boolean(contextRow.nfldata_ok||contextRow.nflverse_ok||contextRow.weather_ok):null},
    history:{updatedAt:historyAt,status:Number(historyRow?.summaries??0)>0?'STATIC READY':'UNAVAILABLE',stale:Number(historyRow?.summaries??0)===0,ageMinutes:ageMinutes(historyAt,now),summaries:Number(historyRow?.summaries??0),throughSeason:2025},
    intelligence:{updatedAt:intelligenceAt,...dynamicStatus(intelligenceAt,now,180,720)}
  };
  const dynamic=['scores','market','context','intelligence'].map(k=>sources[k]).filter(x=>x.updatedAt);
  const worst=dynamic.some(x=>x.status==='STALE')?'STALE':dynamic.some(x=>x.status==='AGING')?'AGING':dynamic.length?'CURRENT':'UNAVAILABLE';
  const freshest=dynamic.map(x=>x.updatedAt).filter(Boolean).sort().reverse()[0]??null;
  return{season:s,week:w,checkedAt:now.toISOString(),status:worst,updatedAt:freshest,sources,contract:{rawHistoricalReads:false,normalUiHeavyReads:false,missingDataFallsBackToHeavyQuery:false}};
}
