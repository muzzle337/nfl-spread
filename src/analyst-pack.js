import { dashboardSnapshot } from "./dashboard-data.js";
import { dataFreshness } from "./data-freshness.js";
import { lineMovementsForWeek } from "./line-movement.js";
import { rankOpportunities } from "./opportunity-focus.js";
import { weekResultsStatus } from "./result-sync.js";
import { signalPerformancePack } from "./signal-performance.js";
import { tierContributorPack } from "./tier-contributors.js";
import { storedGameOutlooksForAnalysis } from "./weekly-picks.js";

export async function buildAnalystPack(db, season, week, now = new Date(), shared = null) {
  const year=Number(season),weekNumber=Number(week);
  if (!Number.isInteger(year)) throw new Error("season is required");
  if (!Number.isInteger(weekNumber)||weekNumber<1||weekNumber>18) throw new Error("week must be between 1 and 18");

  const [dashboard,freshness,outlooks,results,movements,tiers,signals]=await Promise.all([
    dashboardSnapshot(db,now,{season:year,week:weekNumber}),
    dataFreshness(db,{season:year,week:weekNumber,now}),
    storedGameOutlooksForAnalysis(db,year,weekNumber),
    weekResultsStatus(db,year,weekNumber,now),
    lineMovementsForWeek(db,year,weekNumber),
    shared?.tiers ?? tierContributorPack(db,year),
    shared?.signals ?? signalPerformancePack(db,year)
  ]);

  return {
    schemaVersion:"1.0",
    generatedAt:now.toISOString(),
    season:year,
    week:weekNumber,
    source:{storedDataOnly:true,oddsApiCalled:false,providerCreditsUsed:0},
    interpretation:{
      tierPercentages:"Season-to-date ATS bucket history, not a game probability.",
      firstCaptured:"First stored pregame market observation; not guaranteed to be the true opener.",
      outcomes:"ATS and outright results must be analyzed separately."
    },
    freshness,
    dashboard,
    outlooks:{games:outlooks},
    focus:{games:rankOpportunities(outlooks)},
    results,
    movements,
    tierContributors:tiers,
    signalPerformance:signals
  };
}
