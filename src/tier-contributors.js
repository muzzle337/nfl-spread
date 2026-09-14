import { classifyGame, settleAgainstSpread } from "./engine.js";

const ALLOWED_CLASSES = new Set(["AwayDog", "AwayFav", "HomeDog", "HomeFav"]);
const ALLOWED_TIERS = new Set(["<=3", "<=7", ">7"]);

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function tierContributors(db, season, throughWeek, classification, tier) {
  const year = Number(season), week = Number(throughWeek);
  if (!Number.isInteger(year) || !Number.isInteger(week)) throw new Error("season and week are required");
  if (!ALLOWED_CLASSES.has(classification) || !ALLOWED_TIERS.has(tier)) throw new Error("Unsupported category or tier");
  const result = await db.prepare(`
    SELECT id,week,away_team,home_team,kickoff_at,away_score,home_score,
      COALESCE(closing_away_spread,current_away_spread,opening_away_spread) AS away_spread
    FROM games
    WHERE season=? AND week<=? AND season_type='REGULAR' AND status='COMPLETED'
      AND away_score IS NOT NULL AND home_score IS NOT NULL
      AND COALESCE(closing_away_spread,current_away_spread,opening_away_spread) IS NOT NULL
    ORDER BY week,kickoff_at,id
  `).bind(year, week).all();
  const games = [];
  for (const row of result.results ?? []) {
    const awaySpread = finite(row.away_spread);
    if (awaySpread === null) continue;
    const homeSpread = awaySpread === 0 ? 0 : -awaySpread;
    let classified, settled;
    try {
      classified = classifyGame(awaySpread, homeSpread);
      settled = settleAgainstSpread({ awaySpread, homeSpread, awayScore: row.away_score, homeScore: row.home_score });
    } catch { continue; }
    const side = classified.away === classification ? "AWAY" : classified.home === classification ? "HOME" : null;
    if (!side || classified.tier !== tier) continue;
    const outcome = settled.coveringSide === "Push" ? "PUSH" : settled.coveringSide.toUpperCase() === side ? "WIN" : "LOSS";
    games.push({
      id: row.id, week: Number(row.week), kickoffAt: row.kickoff_at,
      awayTeam: row.away_team, homeTeam: row.home_team,
      awayScore: Number(row.away_score), homeScore: Number(row.home_score),
      awaySpread, homeSpread, classification, tier, side, outcome
    });
  }
  const wins = games.filter((game) => game.outcome === "WIN").length;
  const losses = games.filter((game) => game.outcome === "LOSS").length;
  const pushes = games.filter((game) => game.outcome === "PUSH").length;
  const decisions = wins + losses;
  return { season: year, throughWeek: week, classification, tier, wins, losses, pushes, decisions, coverRate: decisions ? Math.round(wins / decisions * 1000) / 10 : null, games };
}
