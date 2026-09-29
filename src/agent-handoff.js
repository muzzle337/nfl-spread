import { buildAnalystPack } from "./analyst-pack.js";
import { resolveDashboardWeek } from "./dashboard-data.js";
import { signalPerformancePack } from "./signal-performance.js";
import { tierContributorPack } from "./tier-contributors.js";

const ANALYST_BRAIN = Object.freeze({
  mission:"Find useful NFL patterns without turning small samples, correlated signals, or postgame information into false certainty.",
  rules:[
    "ATS and outright outcomes are separate. Grade each recommendation against its actual market and selection.",
    "A tier percentage is a season-to-date ATS bucket record, not an individual game's cover or win probability.",
    "Entering-week, frozen pregame, current pregame, closing pregame, live, and postgame evidence are different information states and cannot replace one another.",
    "Complementary home/away categories describe opposite sides of the same games and must not be double-counted as independent evidence.",
    "First Captured is the first stored pregame observation, not necessarily the sportsbook's true opening line.",
    "Exclude post-kickoff observations from opening, movement, closing, and recommendation analysis.",
    "When a line crosses a category or tier, preserve and show the original and current signals equally.",
    "Signal agreement does not prove independence. Identify shared inputs before calling multiple labels confirmation.",
    "Historical, coaching, situational, injury, weather, rest, and primetime context may support or conflict; none silently changes the tier engine.",
    "Win percentage alone does not prove profitability. Profit requires the accepted price, stake, settlement, and net units.",
    "Name contributors and counterexamples. Do not infer missing games or rewrite a pregame thesis using a final result.",
    "When evidence conflicts or is incomplete, recommend PASS rather than manufacture conviction."
  ],
  calibrationCase:{
    matchup:"Philadelphia at Chicago",
    lesson:"Chicago's ATS tier read can be correct while a Philadelphia outright recommendation is wrong. Chicago's frozen pregame bucket and its later postgame live bucket are not interchangeable, and the outright win cannot rewrite the original recommendation."
  }
});

const PROJECT_CONTINUITY = Object.freeze({
  product:"NFL Spread Tool",
  purpose:"A mobile-first decision aid that connects season ATS category/tier patterns to the games that contributed to them and the current slate, while keeping ATS, outright, market, history, and context evidence distinct.",
  productionUrl:"https://nfl-spread-api.sanro4.workers.dev",
  repository:"muzzle337/nfl-spread",
  delivery:{
    sourceControl:"GitHub main",
    runtime:"Cloudflare Worker with D1",
    releaseFlow:"Branch from current main, run unit and Chromium mobile tests, inspect the Cloudflare PR preview on phone, obtain owner approval, merge, then verify production health and smoke tests.",
    currentMilestone:"v0.25.5 plus zero-credit Analyst Pack export from PR #75",
    reportedAppVersionNote:"The runtime currently reports 0.25.3 even though later release milestones have shipped. Treat this as a known version-label cleanup item, not evidence that those releases are absent."
  },
  productContracts:[
    "Primary navigation is Dashboard, Games, Picks, and Tools. Survivor is inactive and must not initialize in the runtime.",
    "Dashboard answers what matters now; Games is the complete slate; Game Detail explains one matchup; Picks handles weekly outright selections; Tools contains maintenance and exports.",
    "Tier Pulse is season-to-date, never isolated to the selected week, and must show week-to-week momentum.",
    "Tapping a category/tier must reveal weekly momentum, every settled contributor, and matching games.",
    "Users can browse the full loaded schedule by week without using provider credits.",
    "Opening/current/closing spreads and moneylines must retain valid pregame timestamps; live prices are not part of the analytical record.",
    "Original and current signals receive equal treatment when movement crosses a tier or category.",
    "Focus ranks transparent evidence and conflict. It is not a new probability and does not alter predictions.",
    "Historical and situational evidence is supporting context and does not alter Focus or Picks unless a later approved release explicitly changes that contract.",
    "One screen has one canonical renderer. Do not restore legacy wrappers, runtime string surgery, duplicate panels, DOM observation hooks, or recurring UI polling.",
    "Paid Odds API actions are explicit, authenticated, and limited to the selected week. Browsing, exports, reconciliation, and stored analysis use zero provider credits.",
    "Personal picks must not be included in analyst exports or continuity handoffs.",
    "Do not merge UI changes without mobile staging review against what the owner actually sees."
  ],
  acceptedDecisions:[
    "Keep the four-screen navigation and leave Survivor dormant.",
    "Preserve category, tier, percentage, record, sample, spread, moneyline, and market movement as key indicators.",
    "Keep frozen pregame evidence immutable and update live season results separately.",
    "Use weekly checkpoints to compare what was known entering a week with what changed as games finish.",
    "Provide read-only exports so another analyst can inspect production evidence without direct production or Odds API access."
  ],
  openWork:[
    "The next Dashboard design should point the user toward actionable games faster without removing evidence. The newer staging direction is preferred, but it remains information-dense and needs mobile hierarchy refinement before production.",
    "Shared-user pick isolation is unresolved: a future sharing model must prevent another user from seeing or changing the owner's picks.",
    "Actual personal betting profitability requires a separate wager ledger containing accepted prices, stakes, settlements, and net units.",
    "Continue collecting weeks before promoting exploratory patterns into strategies; always show contributors and counterexamples.",
    "Clean up the visible application version so it matches the shipped release milestone."
  ],
  nonNegotiables:[
    "Do not overwrite newer agent or developer changes; always integrate from the latest main branch.",
    "Do not spend provider credits for analysis or exports.",
    "Do not use current postgame percentages as frozen pregame evidence.",
    "Do not present a tier cover rate as an individual-game probability.",
    "Do not deploy UI changes straight to production without staging validation unless the owner explicitly overrides the release process."
  ]
});

async function scheduleManifest(db, season) {
  const result=await db.prepare(`SELECT id,week,away_team,home_team,kickoff_at,status,away_score,home_score,
      opening_away_spread,current_away_spread,closing_away_spread
    FROM games WHERE season=? AND season_type='REGULAR' ORDER BY week,kickoff_at,id`).bind(Number(season)).all();
  return (result.results ?? []).map((row)=>({
    id:row.id,week:Number(row.week),awayTeam:row.away_team,homeTeam:row.home_team,
    kickoffAt:row.kickoff_at,status:row.status,awayScore:row.away_score,homeScore:row.home_score,
    market:{
      openingAwaySpread:row.opening_away_spread,currentAwaySpread:row.current_away_spread,closingAwaySpread:row.closing_away_spread
    }
  }));
}

export async function buildCompleteAgentHandoff(db, season, now = new Date()) {
  const year=Number(season);
  if(!Number.isInteger(year))throw new Error("season is required");
  const [active,schedule,tiers,signals]=await Promise.all([
    resolveDashboardWeek(db),scheduleManifest(db,year),tierContributorPack(db,year),signalPerformancePack(db,year)
  ]);
  const activeWeek=active.season===year&&Number.isInteger(active.week)?active.week:null;
  const availableWeeks=[...new Set(schedule.map((game)=>game.week))].filter((week)=>Number.isInteger(week)).sort((a,b)=>a-b);
  const analysisWeeks=availableWeeks.filter((week)=>activeWeek===null||week<=activeWeek);
  const shared={tiers,signals};
  const weekly=await Promise.all(analysisWeeks.map(async(week)=>{
    const pack=await buildAnalystPack(db,year,week,now,shared);
    const {tierContributors,signalPerformance,...weekEvidence}=pack;
    return weekEvidence;
  }));
  return {
    schemaVersion:"1.0",
    handoffType:"NFL_SPREAD_COMPLETE_AGENT_HANDOFF",
    generatedAt:now.toISOString(),
    season:year,
    activeWeek,
    source:{storedDataOnly:true,oddsApiCalled:false,providerCreditsUsed:0,personalPicksIncluded:false},
    startHere:{
      role:"Continue as both product steward and evidence-disciplined NFL analyst.",
      requiredFirstResponse:[
        "Confirm the handoff schema, season, active week, included weeks, 12 tier buckets, and 7 signal groups.",
        "Summarize the product's purpose, analytical rules, current production state, accepted decisions, and open work.",
        "State any missing evidence before making claims or changes.",
        "Do not modify code, spend provider credits, or make betting recommendations until the requested task is clear."
      ],
      ownerPrompt:"Continue from this complete handoff. First confirm the current state and tell me the next unfinished decision or task."
    },
    analystBrain:ANALYST_BRAIN,
    projectContinuity:PROJECT_CONTINUITY,
    evidence:{
      includedAnalysisWeeks:analysisWeeks,
      availableScheduleWeeks:availableWeeks,
      schedule,
      weeks:Object.fromEntries(weekly.map((pack)=>[`week${pack.week}`,pack])),
      tierContributors:tiers,
      signalPerformance:signals
    },
    validation:{
      expectedTierBucketCount:12,
      actualTierBucketCount:Object.keys(tiers.buckets??{}).length,
      expectedSignalGroupCount:7,
      actualSignalGroupCount:Object.keys(signals.contributors??{}).length,
      complete:Boolean(Object.keys(tiers.buckets??{}).length===12&&Object.keys(signals.contributors??{}).length===7)
    },
    limitations:[
      "This is a curated continuity record of material decisions, not a verbatim transcript of every conversation.",
      "Stored First Captured market data is not guaranteed to be a sportsbook's true opening line.",
      "Personal wager profitability cannot be measured without accepted price, stake, settlement, and net-unit records.",
      "Future weeks may contain schedule data without a loaded betting market."
    ]
  };
}
