import { ensureHistorySchema } from './history-schema.js';
import { coachIndicatorSummary } from './history.js';

export async function rebuildStoredHistoricalSummaries(db,{startSeason=2015,endSeason=2025}={}){
  if(!db)throw new Error('Database is not bound');
  await ensureHistorySchema(db);
  const result=await db.prepare(`SELECT season,week,away_team,home_team,away_score,home_score,spread_line,roof,temp_f,wind_mph,away_rest,home_rest,away_coach,home_coach,div_game,prime_time FROM historical_games WHERE season BETWEEN ? AND ? ORDER BY season,week`).bind(startSeason,endSeason).all();
  const rows=result.results||[];
  const coaches=[...new Set(rows.flatMap(r=>[r.away_coach,r.home_coach]).filter(Boolean))].sort();
  await db.prepare(`DELETE FROM historical_coach_summaries WHERE start_season=? AND end_season=?`).bind(startSeason,endSeason).run();
  const statements=coaches.map(coach=>{
    const coachRows=rows.filter(r=>r.away_coach===coach||r.home_coach===coach);
    const summary=coachIndicatorSummary(coachRows,coach);
    return db.prepare(`INSERT INTO historical_coach_summaries(coach,start_season,end_season,summary_json,rebuilt_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)`).bind(coach,startSeason,endSeason,JSON.stringify(summary));
  });
  for(let i=0;i<statements.length;i+=50)await db.batch(statements.slice(i,i+50));
  await db.prepare(`DELETE FROM weekly_outlook_cache`).run();
  return {gamesReadOnce:rows.length,coachesCached:coaches.length,startSeason,endSeason,weeklyOutlookCacheInvalidated:true};
}

export async function d1CacheStatus(db,season,week){
  if(!db)throw new Error('Database is not bound');
  await ensureHistorySchema(db);
  const [hist,weekCache]=await Promise.all([
    db.prepare(`SELECT COUNT(*) summaries,MAX(rebuilt_at) rebuilt_at FROM historical_coach_summaries WHERE start_season=2015 AND end_season=2025`).first(),
    Number.isInteger(Number(season))&&Number.isInteger(Number(week))?db.prepare(`SELECT built_at FROM weekly_outlook_cache WHERE season=? AND week=? LIMIT 1`).bind(Number(season),Number(week)).first():Promise.resolve(null)
  ]);
  return {historicalCoachSummaries:Number(hist?.summaries||0),historicalSummariesRebuiltAt:hist?.rebuilt_at||null,weeklyOutlook:{season:Number(season)||null,week:Number(week)||null,cached:Boolean(weekCache),builtAt:weekCache?.built_at||null},guardrails:{backgroundHeavyPolling:false,rawHistoryReadDuringNormalUi:false,weeklyOutlookCached:true}};
}
