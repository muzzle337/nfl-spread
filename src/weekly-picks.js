import { projectionsForWeek } from "./projection.js";
import { contextForWeek } from "./context.js";
import { historicalIndicatorsForWeek } from "./history-matchups.js";
import { lineMovementsForWeek } from "./line-movement.js";

function finite(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}

export async function ensureWeeklyPicksSchema(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS weekly_pool_picks(
    season INTEGER NOT NULL,
    week INTEGER NOT NULL,
    game_id TEXT NOT NULL,
    team TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(season,week,game_id)
  )`).run();
}

export async function listWeeklyPicks(db,season,week){
  await ensureWeeklyPicksSchema(db);
  const r=await db.prepare(`SELECT game_id,team,updated_at FROM weekly_pool_picks WHERE season=? AND week=? ORDER BY game_id`).bind(season,week).all();
  return (r.results||[]).map(x=>({gameId:x.game_id,team:x.team,updatedAt:x.updated_at}));
}

export async function saveWeeklyPick(db,{season,week,gameId,team}){
  await ensureWeeklyPicksSchema(db);
  const s=Number(season),w=Number(week),id=String(gameId||'').trim(),t=String(team||'').trim();
  if(!Number.isInteger(s)||!Number.isInteger(w)||!id||!t)throw new Error('season, week, gameId and team are required');
  const g=await db.prepare(`SELECT away_team,home_team,kickoff_at FROM games WHERE id=? AND season=? AND week=? LIMIT 1`).bind(id,s,w).first();
  if(!g)throw new Error('Game not found');
  if(t!==g.away_team&&t!==g.home_team)throw new Error('Pick must be one of the teams in the game');
  if(g.kickoff_at && new Date(g.kickoff_at).getTime() <= Date.now()) throw new Error('This game has already started');
  await db.prepare(`INSERT INTO weekly_pool_picks(season,week,game_id,team,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(season,week,game_id) DO UPDATE SET team=excluded.team,updated_at=CURRENT_TIMESTAMP`).bind(s,w,id,t).run();
  return {season:s,week:w,gameId:id,team:t};
}

function notableSummary(side){
  return (side?.notable||[]).slice(0,3).map(x=>({label:x.label,games:x.games,winPct:finite(x.record?.winPct),coverPct:finite(x.spreadRecord?.coverPct)}));
}

function historicalOutrightDirection(history,awayTeam,homeTeam){
  function score(side){
    let s=0;
    for(const x of side?.notable||[]){
      const win=finite(x.record?.winPct);
      if(win!==null&&win>=65)s+=1;
      else if(win!==null&&win<=35)s-=1;
    }
    return s;
  }
  const a=score(history?.away),h=score(history?.home);
  if(a===h)return null;
  if(a>h && a>0)return awayTeam;
  if(h>a && h>0)return homeTeam;
  if(a<0 && h>=0)return homeTeam;
  if(h<0 && a>=0)return awayTeam;
  return null;
}

function movementText(m){
  const mag=finite(m?.movementMagnitude);if(mag===null||mag===0)return 'Line stable';
  const toward=m.direction==='TOWARD_AWAY'?m.awayTeam:m.direction==='TOWARD_HOME'?m.homeTeam:null;
  return toward?`Line moved ${mag} toward ${toward}`:`Line moved ${mag}`;
}

export function outlookLabel(game,history,context){
  const awayP=finite(game.moneyline?.awayWinProbability),homeP=finite(game.moneyline?.homeWinProbability);
  const outright=awayP===null&&homeP===null?null:(awayP>=homeP?game.awayTeam:game.homeTeam);
  const spread=game.projectedTeam||null;
  const histSide=historicalOutrightDirection(history,game.awayTeam,game.homeTeam);
  const contextSide=context?.directionalTeam||null;
  const signals=[outright,spread,histSide,contextSide].filter(Boolean);
  const counts=new Map();for(const s of signals)counts.set(s,(counts.get(s)||0)+1);
  const ranked=[...counts.entries()].sort((a,b)=>b[1]-a[1]);const leader=ranked[0]||null;
  if(!leader)return {level:'LOW INFO',team:null,reason:'Not enough directional information yet.',inputs:{outright,spread,historical:histSide,context:contextSide}};
  if(leader[1]>=3)return {level:'STRONG AGREEMENT',team:leader[0],reason:'Multiple independent indicators point the same way.',inputs:{outright,spread,historical:histSide,context:contextSide}};
  if(leader[1]===2&&signals.length>=3)return {level:'MIXED',team:leader[0],reason:'Some indicators agree, but meaningful signals conflict.',inputs:{outright,spread,historical:histSide,context:contextSide}};
  if(leader[1]>=2)return {level:'MODERATE AGREEMENT',team:leader[0],reason:'Two useful indicators align.',inputs:{outright,spread,historical:histSide,context:contextSide}};
  return {level:'LOW INFO',team:leader[0],reason:'Only one directional indicator is currently available.',inputs:{outright,spread,historical:histSide,context:contextSide}};
}

async function resultsForWeek(db,season,week){
  const r=await db.prepare(`SELECT id,status,away_team,home_team,away_score,home_score FROM games WHERE season=? AND week=? AND season_type='REGULAR'`).bind(season,week).all();
  return new Map((r.results||[]).map(g=>[String(g.id),g]));
}

function pickResult(game,pick){
  if(!game||!pick||game.status!=='COMPLETED'||game.away_score===null||game.home_score===null)return null;
  const a=Number(game.away_score),h=Number(game.home_score);if(a===h)return 'TIE';
  const winner=a>h?game.away_team:game.home_team;return pick===winner?'CORRECT':'WRONG';
}

export async function poolSeasonSummary(db,season){
  await ensureWeeklyPicksSchema(db);
  const r=await db.prepare(`SELECT p.week,p.team,g.away_team,g.home_team,g.away_score,g.home_score,g.status FROM weekly_pool_picks p JOIN games g ON g.id=p.game_id WHERE p.season=? ORDER BY p.week`).bind(season).all();
  let correct=0,wrong=0,pending=0;
  const weeks=new Map();
  for(const x of r.results||[]){
    const result=pickResult(x,x.team);if(result==='CORRECT')correct++;else if(result==='WRONG')wrong++;else pending++;
    const w=Number(x.week),row=weeks.get(w)||{week:w,correct:0,wrong:0,pending:0};
    if(result==='CORRECT')row.correct++;else if(result==='WRONG')row.wrong++;else row.pending++;weeks.set(w,row);
  }
  return {correct,wrong,pending,decided:correct+wrong,accuracy:(correct+wrong)?Math.round(correct/(correct+wrong)*1000)/10:null,weeks:[...weeks.values()]};
}

export async function weeklyGameOutlooks(db,season,week){
  const [dash,ctx,moves,picks,results]=await Promise.all([
    projectionsForWeek(db,season,week),contextForWeek(db,season,week),lineMovementsForWeek(db,season,week),listWeeklyPicks(db,season,week),resultsForWeek(db,season,week)
  ]);
  const hist=await historicalIndicatorsForWeek(db,ctx.games||[],{startSeason:2015,endSeason:2025});
  const cBy=new Map((ctx.games||[]).map(g=>[g.gameId,g]));
  const hBy=new Map((hist||[]).map(g=>[g.gameId,g]));
  const mBy=new Map((moves||[]).map(g=>[g.gameId,g]));
  const pBy=new Map((picks||[]).map(p=>[p.gameId,p]));
  return (dash.games||[]).map(g=>{
    const c=cBy.get(g.id)||null,h=hBy.get(g.id)||null,m=mBy.get(g.id)||null,p=pBy.get(g.id)||null;
    const label=outlookLabel(g,h,null);
    const stored=results.get(String(g.id));
    return {
      gameId:g.id,awayTeam:g.awayTeam,homeTeam:g.homeTeam,kickoffAt:g.kickoffAt,
      spread:{away:g.medianAwaySpread,home:g.medianHomeSpread,projectedTeam:g.projectedTeam,coverRate:g.projectedCoverRate,grade:g.grade,sampleSize:g.sampleSize,status:g.projectionStatus},
      market:{awayMoneyline:g.moneyline?.consensusAwayMoneyline??null,homeMoneyline:g.moneyline?.consensusHomeMoneyline??null,awayWinPct:g.moneyline?.awayWinProbability??null,homeWinPct:g.moneyline?.homeWinProbability??null,bookmakers:g.moneyline?.moneylineBookmakerCount??0},
      movement:m?{...m,text:movementText(m)}:null,
      history:h?{away:{coach:h.away.coach,overall:h.away.overall,notable:notableSummary(h.away)},home:{coach:h.home.coach,overall:h.home.overall,notable:notableSummary(h.home)},notableCount:h.notableCount}:null,
      context:c?{venue:[c.stadium,c.roof,c.surface].filter(Boolean).join(' · '),weather:c.weather,rest:{away:c.awayRest,home:c.homeRest},observations:c.observations||[],quality:c.quality}:null,
      outlook:label,pick:p?.team||null,pickResult:pickResult(stored,p?.team||null),final:stored&&stored.status==='COMPLETED'?{awayScore:Number(stored.away_score),homeScore:Number(stored.home_score)}:null
    };
  });
}
