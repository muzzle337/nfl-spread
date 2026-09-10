function finite(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function pct(v){const n=finite(v);if(n===null)return null;return Math.abs(n)<=1?n*100:n}
function teamForSide(game,side){return side==='AWAY'?game.awayTeam:side==='HOME'?game.homeTeam:null}
function code(name){return String(name||'').trim()}

function contextDirection(game){
  const scores={AWAY:0,HOME:0};
  for(const o of game.context?.observations||[]){
    if(o.side==='AWAY'||o.side==='HOME') scores[o.side]+=o.kind==='supporting'?2:1;
  }
  if(scores.AWAY===scores.HOME)return null;
  const side=scores.AWAY>scores.HOME?'AWAY':'HOME';
  const other=side==='AWAY'?'HOME':'AWAY';
  return scores[side]>=2&&scores[side]>=scores[other]+1?teamForSide(game,side):null;
}

function marketSignal(game){
  const a=pct(game.market?.awayWinPct),h=pct(game.market?.homeWinPct);
  if(a===null||h===null||a===h)return null;
  const team=a>h?game.awayTeam:game.homeTeam;
  const win=Math.max(a,h),gap=Math.abs(a-h);
  const strength=win>=70||gap>=40?'strong':win>=60||gap>=20?'medium':'light';
  return {team,strength,detail:`${code(team)} ${Math.round(win*10)/10}% no-vig market win probability`};
}

function spreadSignal(game){
  const team=game.spread?.projectedTeam||null,rate=pct(game.spread?.coverRate),sample=finite(game.spread?.sampleSize);
  if(!team||rate===null||rate<55)return null;
  return {team,strength:rate>=70?'strong':rate>=60?'medium':'light',detail:`${code(team)} ${Math.round(rate*10)/10}% current-season spread rate${sample!==null?` (${sample}-game sample)`:''}`};
}

function historySignal(game){
  const team=game.outlook?.inputs?.historical||null;
  if(!team)return null;
  const side=team===game.awayTeam?game.history?.away:team===game.homeTeam?game.history?.home:null;
  const notable=(side?.notable||[]).filter(x=>finite(x.winPct)!==null);
  const best=notable.sort((a,b)=>Math.abs((finite(b.winPct)||50)-50)-Math.abs((finite(a.winPct)||50)-50))[0];
  return {team,strength:notable.length>=2?'medium':'light',detail:best?`${side.coach||code(team)}: ${best.label} ${best.winPct}% outright (${best.games}-game sample)`:`Historical situational direction favors ${code(team)}`};
}

function contextSignal(game){
  const team=contextDirection(game);if(!team)return null;
  const side=team===game.awayTeam?'AWAY':'HOME';
  const obs=(game.context?.observations||[]).filter(o=>o.side===side).slice(0,2);
  return {team,strength:obs.length>=2?'medium':'light',detail:obs.length?obs.map(o=>`${o.label}: ${o.detail}`).join(' · '):`Context favors ${code(team)}`};
}

function movementSupport(game,team){
  const m=game.movement;if(!m||!team)return null;
  const toward=m.direction==='TOWARD_AWAY'?game.awayTeam:m.direction==='TOWARD_HOME'?game.homeTeam:null;
  const mag=Math.abs(finite(m.movementMagnitude)||0);
  if(!toward||mag<0.5)return null;
  return {team:toward,detail:m.text||`Line moved ${mag} toward ${code(toward)}`};
}

function bestUse(game,team,signals,conflicts){
  const market=signals.find(s=>s.domain==='Market'&&s.team===team);
  const spread=signals.find(s=>s.domain==='Current season'&&s.team===team);
  const marketPct=team===game.awayTeam?pct(game.market?.awayWinPct):pct(game.market?.homeWinPct);
  if(spread&&market&&conflicts.length===0)return 'SPREAD + OUTRIGHT';
  if(spread)return 'SPREAD';
  if(market&&marketPct!==null&&marketPct>=65&&conflicts.length<=1)return 'POOL / SURVIVOR';
  if(market)return 'OUTRIGHT POOL';
  return 'WATCH';
}

export function evaluateOpportunity(game){
  const raw=[
    ['Market',marketSignal(game)],
    ['Current season',spreadSignal(game)],
    ['Historical',historySignal(game)],
    ['Context',contextSignal(game)]
  ].filter(([,s])=>s).map(([domain,s])=>({domain,...s}));
  const counts=new Map();for(const s of raw)counts.set(s.team,(counts.get(s.team)||0)+1);
  const ranked=[...counts.entries()].sort((a,b)=>b[1]-a[1]);
  const leader=ranked[0]||null;
  const team=leader&&(!ranked[1]||leader[1]>ranked[1][1])?leader[0]:null;
  const support=team?raw.filter(s=>s.team===team):[];
  const conflicts=team?raw.filter(s=>s.team!==team):raw;
  const strong=support.filter(s=>s.strength==='strong').length;
  const movement=movementSupport(game,team);
  if(movement){
    if(movement.team===team)support.push({domain:'Market movement',team,strength:'light',detail:movement.detail,secondary:true});
    else conflicts.push({domain:'Market movement',team:movement.team,strength:'light',detail:movement.detail,secondary:true});
  }
  const independentSupport=support.filter(s=>!s.secondary).length;
  let focus='LOW';
  if(team&&independentSupport>=3)focus='HIGH';
  else if(team&&independentSupport>=2&&(strong>=1||conflicts.filter(s=>!s.secondary).length===0))focus='HIGH';
  else if(team&&independentSupport>=2)focus='MEDIUM';
  else if(raw.length||movement)focus='WATCH';
  const opportunity=team?`${code(team)} — ${bestUse(game,team,support,conflicts)}`:'No clear side — monitor';
  const edge=support.slice(0,4).map(s=>({domain:s.domain,detail:s.detail,strength:s.strength}));
  const conflict=conflicts.slice(0,3).map(s=>({domain:s.domain,team:s.team,detail:s.detail}));
  return {
    gameId:game.gameId,awayTeam:game.awayTeam,homeTeam:game.homeTeam,kickoffAt:game.kickoffAt,
    focus,team,opportunity,bestUse:team?bestUse(game,team,support,conflicts):'WATCH',
    independentSignals:independentSupport,availableDomains:raw.length,
    edge,conflict,
    summary:team?`${independentSupport} independent signal${independentSupport===1?'':'s'} support ${code(team)}${conflict.length?`; ${conflict.length} conflict${conflict.length===1?'':'s'} to review`:' with no opposing primary signal'}.`:'Signals are mixed or too thin to call an edge.',
    guardrail:'Focus is an evidence-ranking label, not a win probability or betting recommendation.'
  };
}

const ORDER={HIGH:4,MEDIUM:3,WATCH:2,LOW:1};
export function rankOpportunities(games=[]){
  return games.map(evaluateOpportunity).sort((a,b)=>ORDER[b.focus]-ORDER[a.focus]||b.independentSignals-a.independentSignals||b.availableDomains-a.availableDomains||String(a.gameId).localeCompare(String(b.gameId)));
}
