import { consensusForGame, consensusLinesForWeek } from "./consensus.js";
import { classifyGame, settleAgainstSpread } from "./engine.js";

const DEFAULT_THRESHOLDS = Object.freeze({
  focusMin: 55,
  gradeAMin: 70,
  gradeBMin: 60
});

const TIER_DEFINITIONS = Object.freeze({
  PICK_EM: "0",
  "<=3": "0.5-3",
  "<=7": "3.5-7",
  ">7": "7.5+"
});

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function bucketKey(classification, tier) {
  return `${classification}|${tier}`;
}

function emptyBucket(classification, tier) {
  return {
    classification,
    tier,
    wins: 0,
    losses: 0,
    pushes: 0,
    decisions: 0,
    coverRate: null
  };
}

function finalizeBucket(bucket) {
  const decisions = bucket.wins + bucket.losses;
  return {
    ...bucket,
    decisions,
    coverRate: decisions ? Math.round((bucket.wins / decisions) * 1000) / 10 : null
  };
}

function recordBucket(map, classification, tier, result) {
  const key = bucketKey(classification, tier);
  const bucket = map.get(key) ?? emptyBucket(classification, tier);
  if (result === "WIN") bucket.wins += 1;
  else if (result === "LOSS") bucket.losses += 1;
  else bucket.pushes += 1;
  map.set(key, bucket);
}

export function buildCurrentSeasonStats(settledGames) {
  const buckets = new Map();
  let gamesConsidered = 0;
  let gamesSkipped = 0;

  for (const game of Array.isArray(settledGames) ? settledGames : []) {
    const awaySpread = finiteNumber(game.awaySpread);
    const homeSpread = finiteNumber(game.homeSpread);
    const awayScore = finiteNumber(game.awayScore);
    const homeScore = finiteNumber(game.homeScore);

    if ([awaySpread, homeSpread, awayScore, homeScore].some((value) => value === null)) {
      gamesSkipped += 1;
      continue;
    }

    let classification;
    let settlement;
    try {
      classification = classifyGame(awaySpread, homeSpread);
      settlement = settleAgainstSpread({ awaySpread, homeSpread, awayScore, homeScore });
    } catch {
      gamesSkipped += 1;
      continue;
    }

    gamesConsidered += 1;
    if (settlement.coveringSide === "Push") {
      recordBucket(buckets, classification.away, classification.tier, "PUSH");
      recordBucket(buckets, classification.home, classification.tier, "PUSH");
      continue;
    }

    const awayWon = settlement.coveringSide === "Away";
    recordBucket(buckets, classification.away, classification.tier, awayWon ? "WIN" : "LOSS");
    recordBucket(buckets, classification.home, classification.tier, awayWon ? "LOSS" : "WIN");
  }

  return {
    gamesConsidered,
    gamesSkipped,
    buckets: Object.fromEntries(
      [...buckets.entries()].map(([key, bucket]) => [key, finalizeBucket(bucket)])
    )
  };
}

export function gradeForRate(rate, thresholds = DEFAULT_THRESHOLDS) {
  const pct = finiteNumber(rate);
  if (pct === null) return null;
  if (pct >= thresholds.gradeAMin) return "A";
  if (pct >= thresholds.gradeBMin) return "B";
  if (pct >= thresholds.focusMin) return "C";
  return null;
}

function statFor(stats, classification, tier) {
  return stats?.buckets?.[bucketKey(classification, tier)] ?? emptyBucket(classification, tier);
}

export function projectConsensusGame(game, stats, thresholds = DEFAULT_THRESHOLDS) {
  const awaySpread = finiteNumber(game?.medianAwaySpread);
  const homeSpread = finiteNumber(game?.medianHomeSpread);

  if (awaySpread === null || homeSpread === null) {
    return {
      ...game,
      projectionStatus: "NO_MARKET_LINE",
      classification: null,
      currentSeasonStats: null,
      projectedSide: null,
      projectedTeam: null,
      projectedCoverRate: null,
      sampleSize: 0,
      focus: false,
      grade: null
    };
  }

  const classification = classifyGame(awaySpread, homeSpread);
  const awayStat = finalizeBucket(statFor(stats, classification.away, classification.tier));
  const homeStat = finalizeBucket(statFor(stats, classification.home, classification.tier));
  const awayRate = awayStat.coverRate;
  const homeRate = homeStat.coverRate;

  if (awayRate === null && homeRate === null) {
    return {
      ...game,
      classification,
      currentSeasonStats: { away: awayStat, home: homeStat },
      projectionStatus: "INSUFFICIENT_DATA",
      projectedSide: null,
      projectedTeam: null,
      projectedCoverRate: null,
      sampleSize: 0,
      focus: false,
      grade: null
    };
  }

  if (awayRate !== null && homeRate !== null && awayRate === homeRate) {
    return {
      ...game,
      classification,
      currentSeasonStats: { away: awayStat, home: homeStat },
      projectionStatus: "NO_EDGE",
      projectedSide: null,
      projectedTeam: null,
      projectedCoverRate: awayRate,
      sampleSize: Math.max(awayStat.decisions, homeStat.decisions),
      focus: false,
      grade: null
    };
  }

  const chooseAway = homeRate === null || (awayRate !== null && awayRate > homeRate);
  const chosen = chooseAway ? awayStat : homeStat;
  const projectedSide = chooseAway ? "AWAY" : "HOME";
  const projectedTeam = chooseAway ? game.awayTeam : game.homeTeam;
  const projectedCoverRate = chosen.coverRate;
  const focus = projectedCoverRate !== null && projectedCoverRate >= thresholds.focusMin;

  return {
    ...game,
    classification,
    currentSeasonStats: { away: awayStat, home: homeStat },
    projectionStatus: "READY",
    projectedSide,
    projectedTeam,
    projectedClassification: chooseAway ? classification.away : classification.home,
    projectedCoverRate,
    sampleSize: chosen.decisions,
    focus,
    grade: focus ? gradeForRate(projectedCoverRate, thresholds) : null
  };
}

async function latestBookLinesForGame(db, gameId) {
  const result = await db.prepare(`
    SELECT source, away_spread, captured_at
    FROM line_snapshots ls
    WHERE ls.game_id = ?
      AND ls.id = (
        SELECT MAX(inner_ls.id)
        FROM line_snapshots inner_ls
        WHERE inner_ls.game_id = ls.game_id
          AND inner_ls.source = ls.source
      )
    ORDER BY source ASC
  `).bind(gameId).all();
  return result.results ?? [];
}

async function currentSeasonSettledGamesBeforeWeek(db, season, week) {
  const result = await db.prepare(`
    SELECT
      id, season, week, season_type, away_team, home_team, kickoff_at, status,
      closing_away_spread, current_away_spread, away_score, home_score
    FROM games
    WHERE season = ?
      AND season_type = 'REGULAR'
      AND week < ?
      AND away_score IS NOT NULL
      AND home_score IS NOT NULL
    ORDER BY week ASC, kickoff_at ASC, id ASC
  `).bind(season, week).all();

  const settled = [];
  let skippedWithoutLine = 0;

  for (const game of result.results ?? []) {
    const latestBooks = await latestBookLinesForGame(db, game.id);
    const consensus = latestBooks.length ? consensusForGame(game, latestBooks) : null;
    const fallbackAwaySpread = finiteNumber(game.closing_away_spread) ?? finiteNumber(game.current_away_spread);
    const awaySpread = consensus?.medianAwaySpread ?? fallbackAwaySpread;

    if (awaySpread === null) {
      skippedWithoutLine += 1;
      continue;
    }

    settled.push({
      awaySpread,
      homeSpread: awaySpread === 0 ? 0 : -awaySpread,
      awayScore: game.away_score,
      homeScore: game.home_score
    });
  }

  return { settled, skippedWithoutLine };
}

async function projectionThresholds(db) {
  const thresholds = { ...DEFAULT_THRESHOLDS };
  const result = await db.prepare(`
    SELECT key, value
    FROM settings
    WHERE key IN ('focus_min', 'grade_a_min', 'grade_b_min')
  `).all();

  for (const row of result.results ?? []) {
    const value = finiteNumber(row.value);
    if (value === null) continue;
    if (row.key === "focus_min") thresholds.focusMin = value;
    else if (row.key === "grade_a_min") thresholds.gradeAMin = value;
    else if (row.key === "grade_b_min") thresholds.gradeBMin = value;
  }

  if (!(thresholds.gradeAMin >= thresholds.gradeBMin && thresholds.gradeBMin >= thresholds.focusMin)) {
    return { ...DEFAULT_THRESHOLDS };
  }
  return thresholds;
}

export async function projectionsForWeek(db, season, week) {
  if (!db) throw new Error("Database is not bound");
  const seasonNumber = Number(season);
  const weekNumber = Number(week);
  if (!Number.isInteger(seasonNumber) || !Number.isInteger(weekNumber) || weekNumber < 1) {
    throw new Error("Season and week must be valid integers");
  }

  const [consensus, history, thresholds] = await Promise.all([
    consensusLinesForWeek(db, seasonNumber, weekNumber),
    currentSeasonSettledGamesBeforeWeek(db, seasonNumber, weekNumber),
    projectionThresholds(db)
  ]);

  const stats = buildCurrentSeasonStats(history.settled);
  const games = consensus.games.map((game) => projectConsensusGame(game, stats, thresholds));

  return {
    season: seasonNumber,
    week: weekNumber,
    seasonType: "REGULAR",
    gameCount: games.length,
    projectionBasis: "current_season_completed_prior_weeks",
    statsThroughWeek: weekNumber - 1,
    currentSeasonOnly: true,
    tierDefinitions: TIER_DEFINITIONS,
    thresholds,
    currentSeasonGamesConsidered: stats.gamesConsidered,
    currentSeasonGamesSkipped: stats.gamesSkipped + history.skippedWithoutLine,
    focusCount: games.filter((game) => game.focus).length,
    games
  };
}
