import { classifyGame, settleAgainstSpread } from "./engine.js";
import { buildCurrentSeasonStats } from "./projection.js";

const ALLOWED_CLASSES = new Set(["AwayDog", "AwayFav", "HomeDog", "HomeFav"]);
const ALLOWED_TIERS = new Set(["<=3", "<=7", ">7"]);

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function settledSeasonGames(db, season) {
  const year = Number(season);
  if (!Number.isInteger(year)) throw new Error("season is required");
  const result = await db.prepare(`
    SELECT id,week,away_team,home_team,kickoff_at,away_score,home_score,
      COALESCE(closing_away_spread,opening_away_spread) AS away_spread
    FROM games
    WHERE season=? AND season_type='REGULAR' AND status='COMPLETED'
      AND away_score IS NOT NULL AND home_score IS NOT NULL
      AND COALESCE(closing_away_spread,opening_away_spread) IS NOT NULL
    ORDER BY week,kickoff_at,id
  `).bind(year).all();
  return result.results ?? [];
}

function normalizedSettled(row) {
  const awaySpread = finite(row.away_spread);
  if (awaySpread === null) return null;
  return {
    id: row.id, week: Number(row.week), kickoffAt: row.kickoff_at,
    awayTeam: row.away_team, homeTeam: row.home_team,
    awayScore: Number(row.away_score), homeScore: Number(row.home_score),
    awaySpread, homeSpread: awaySpread === 0 ? 0 : -awaySpread
  };
}

function bucketMomentum(rows, classification, tier) {
  const weeks = [...new Set(rows.map((row) => row.week))].sort((a,b) => a-b);
  return weeks.map((week) => {
    const weekly = buildCurrentSeasonStats(rows.filter((row) => row.week === week)).buckets[`${classification}|${tier}`] ?? null;
    const cumulative = buildCurrentSeasonStats(rows.filter((row) => row.week <= week)).buckets[`${classification}|${tier}`] ?? null;
    return {
      week,
      weekly: weekly ?? { wins:0,losses:0,pushes:0,decisions:0,coverRate:null },
      cumulative: cumulative ?? { wins:0,losses:0,pushes:0,decisions:0,coverRate:null }
    };
  }).filter((row) => row.weekly.decisions || row.weekly.pushes);
}

export async function seasonTierPulse(db, season) {
  const year = Number(season);
  if (!Number.isInteger(year)) throw new Error("season is required");
  const rows = (await settledSeasonGames(db,year)).map(normalizedSettled).filter(Boolean);
  const stats = buildCurrentSeasonStats(rows);
  const momentum = {};
  for (const classification of ALLOWED_CLASSES) {
    for (const tier of ALLOWED_TIERS) momentum[`${classification}|${tier}`] = bucketMomentum(rows,classification,tier);
  }
  return {
    season: year,
    throughWeek: rows.length ? Math.max(...rows.map((row) => row.week)) : null,
    gamesConsidered: stats.gamesConsidered,
    gamesSkipped: stats.gamesSkipped,
    buckets: stats.buckets,
    momentum
  };
}

export async function tierContributors(db, season, classification, tier) {
  const year = Number(season);
  if (!Number.isInteger(year)) throw new Error("season is required");
  if (!ALLOWED_CLASSES.has(classification) || !ALLOWED_TIERS.has(tier)) throw new Error("Unsupported category or tier");
  const rows = await settledSeasonGames(db,year);
  const games = [];
  for (const row of rows) {
    const game = normalizedSettled(row);
    if (!game) continue;
    let classified, settled;
    try {
      classified = classifyGame(game.awaySpread, game.homeSpread);
      settled = settleAgainstSpread(game);
    } catch { continue; }
    const side = classified.away === classification ? "AWAY" : classified.home === classification ? "HOME" : null;
    if (!side || classified.tier !== tier) continue;
    const outcome = settled.coveringSide === "Push" ? "PUSH" : settled.coveringSide.toUpperCase() === side ? "WIN" : "LOSS";
    games.push({
      id: row.id, week: Number(row.week), kickoffAt: row.kickoff_at,
      awayTeam: row.away_team, homeTeam: row.home_team,
      awayScore: Number(row.away_score), homeScore: Number(row.home_score),
      awaySpread:game.awaySpread, homeSpread:game.homeSpread, classification, tier, side, outcome
    });
  }
  const wins = games.filter((game) => game.outcome === "WIN").length;
  const losses = games.filter((game) => game.outcome === "LOSS").length;
  const pushes = games.filter((game) => game.outcome === "PUSH").length;
  const decisions = wins + losses;
  return {
    season: year, throughWeek:games.length?Math.max(...games.map((game)=>game.week)):null,
    classification, tier, wins, losses, pushes, decisions,
    coverRate: decisions ? Math.round(wins / decisions * 1000) / 10 : null,
    momentum: bucketMomentum(games,classification,tier), games
  };
}
