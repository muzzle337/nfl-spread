import { ensureMarketSchema } from "./market-schema.js";
import { consensusMoneylineForGame, noVigProbabilities } from "./moneyline.js";
import { survivorRecommendations } from "./survivor.js";

function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round1(value) {
  const n = num(value);
  return n === null ? null : Math.round(n * 10) / 10;
}

function average(values) {
  const good = values.map(num).filter((v) => v !== null);
  return good.length ? good.reduce((a, b) => a + b, 0) / good.length : null;
}

function standardDeviation(values) {
  const good = values.map(num).filter((v) => v !== null);
  if (good.length < 2) return 0;
  const mean = average(good);
  return Math.sqrt(good.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / good.length);
}

export function marketAgreement(probabilities) {
  const good = probabilities.map(num).filter((v) => v !== null);
  if (!good.length) return { label: "Unavailable", spread: null, standardDeviation: null };
  const range = Math.max(...good) - Math.min(...good);
  const sd = standardDeviation(good);
  const label = range <= 3 ? "Strong" : range <= 7 ? "Moderate" : "Mixed";
  return { label, spread: round1(range), standardDeviation: round1(sd) };
}

export function alternativeDrop(topProbability, alternativeProbability) {
  const top = num(topProbability);
  const alt = num(alternativeProbability);
  if (top === null || alt === null) return null;
  return round1(top - alt);
}

export function calibrationBucket(probability) {
  const p = num(probability);
  if (p === null) return null;
  if (p >= 90) return "90%+";
  if (p >= 80) return "80–89.9%";
  if (p >= 70) return "70–79.9%";
  if (p >= 60) return "60–69.9%";
  return "50–59.9%";
}

export function chooseStrategicCandidate(candidates, exposureByTeam = {}) {
  const available = (candidates ?? []).filter((c) => c.available !== false && num(c.winProbability) !== null)
    .sort((a, b) => b.winProbability - a.winProbability);
  if (!available.length) return null;
  const safest = available[0];
  const nearSafest = available.filter((c) => safest.winProbability - c.winProbability <= 4);
  nearSafest.sort((a, b) => {
    const futureA = num(a.futureValue?.bestFutureProbability) ?? a.winProbability;
    const futureB = num(b.futureValue?.bestFutureProbability) ?? b.winProbability;
    const saveGapA = Math.max(0, futureA - a.winProbability);
    const saveGapB = Math.max(0, futureB - b.winProbability);
    if (saveGapA !== saveGapB) return saveGapA - saveGapB;
    const exposureA = Number(exposureByTeam[a.team] ?? 0);
    const exposureB = Number(exposureByTeam[b.team] ?? 0);
    if (exposureA !== exposureB) return exposureA - exposureB;
    return b.winProbability - a.winProbability;
  });
  const pick = nearSafest[0];
  const reasons = [];
  if (pick.team !== safest.team) reasons.push(`Within ${round1(safest.winProbability - pick.winProbability)} pts of the safest team`);
  const futureBest = num(pick.futureValue?.bestFutureProbability);
  if (futureBest !== null && futureBest <= pick.winProbability + 2) reasons.push("Little additional future value to preserve");
  const exposure = Number(exposureByTeam[pick.team] ?? 0);
  if (exposure === 0) reasons.push("Currently unused across the six entries this week");
  return { ...pick, reasons, safetyDifference: round1(safest.winProbability - pick.winProbability) };
}

async function entriesAndPicks(db, season) {
  const [entryRows, pickRows] = await Promise.all([
    db.prepare(`SELECT id, name, active FROM survivor_entries WHERE season = ? AND active = 1 ORDER BY id ASC`).bind(season).all(),
    db.prepare(`
      SELECT p.id, p.entry_id, p.season, p.week, p.team, p.game_id, p.created_at, p.updated_at,
             g.away_team, g.home_team, g.away_score, g.home_score, g.status
      FROM survivor_picks p
      LEFT JOIN games g ON g.id = p.game_id
      WHERE p.season = ?
      ORDER BY p.entry_id ASC, p.week ASC
    `).bind(season).all()
  ]);
  const entries = entryRows.results ?? [];
  const picks = pickRows.results ?? [];
  return { entries, picks };
}

function pickOutcome(pick) {
  const away = num(pick.away_score);
  const home = num(pick.home_score);
  if (away === null || home === null || pick.status !== "COMPLETED") return "PENDING";
  if (away === home) return "TIE";
  const winner = away > home ? pick.away_team : pick.home_team;
  return winner === pick.team ? "SURVIVED" : "ELIMINATED";
}

async function currentMarketDetails(db, board) {
  const output = new Map();
  for (const candidate of board) {
    if (output.has(candidate.gameId)) continue;
    const rows = await db.prepare(`
      SELECT source, away_moneyline, home_moneyline, captured_at
      FROM moneyline_snapshots
      WHERE game_id = ?
      ORDER BY id ASC
    `).bind(candidate.gameId).all();
    const all = rows.results ?? [];
    const firstBySource = new Map();
    const latestBySource = new Map();
    for (const row of all) {
      if (!firstBySource.has(row.source)) firstBySource.set(row.source, row);
      latestBySource.set(row.source, row);
    }
    const game = { id: candidate.gameId };
    const first = consensusMoneylineForGame(game, [...firstBySource.values()]);
    const latest = consensusMoneylineForGame(game, [...latestBySource.values()]);
    output.set(candidate.gameId, { first, latest });
  }
  return output;
}

async function futureMarkets(db, season, week, horizon = 5) {
  const rows = await db.prepare(`
    SELECT season, week, game_id, away_team, home_team, kickoff_at,
           away_moneyline, home_moneyline, away_win_probability, home_win_probability,
           away_spread, home_spread, captured_at
    FROM survivor_future_markets
    WHERE season = ? AND week > ? AND week <= ?
    ORDER BY week ASC, kickoff_at ASC
  `).bind(season, week, week + horizon).all();
  return rows.results ?? [];
}

function futureValueForTeam(team, futureRows) {
  const opportunities = [];
  for (const row of futureRows) {
    let probability = null;
    let opponent = null;
    let side = null;
    if (row.away_team === team) {
      probability = num(row.away_win_probability); opponent = row.home_team; side = "AWAY";
    } else if (row.home_team === team) {
      probability = num(row.home_win_probability); opponent = row.away_team; side = "HOME";
    }
    if (probability === null) continue;
    opportunities.push({ week: Number(row.week), opponent, side, winProbability: probability });
  }
  opportunities.sort((a, b) => b.winProbability - a.winProbability);
  const best = opportunities[0] ?? null;
  const strongCount = opportunities.filter((o) => o.winProbability >= 70).length;
  return {
    dataAvailable: opportunities.length > 0,
    bestFutureProbability: best?.winProbability ?? null,
    bestFutureWeek: best?.week ?? null,
    bestFutureOpponent: best?.opponent ?? null,
    strongFutureSpots: strongCount,
    scarcity: opportunities.length === 0 ? "Unavailable" : strongCount <= 1 ? "Scarce" : strongCount <= 2 ? "Moderate" : "Flexible",
    opportunities
  };
}

async function calibration(db, season, beforeWeek) {
  const games = await db.prepare(`
    SELECT id, away_team, home_team, away_score, home_score
    FROM games
    WHERE season = ? AND week < ? AND status = 'COMPLETED'
      AND away_score IS NOT NULL AND home_score IS NOT NULL
    ORDER BY week ASC, kickoff_at ASC
  `).bind(season, beforeWeek).all();
  const buckets = new Map();
  for (const game of games.results ?? []) {
    const latestRows = await db.prepare(`
      SELECT source, away_moneyline, home_moneyline, captured_at
      FROM moneyline_snapshots ml
      WHERE game_id = ? AND id = (
        SELECT MAX(x.id) FROM moneyline_snapshots x WHERE x.game_id = ml.game_id AND x.source = ml.source
      )
    `).bind(game.id).all();
    const consensus = consensusMoneylineForGame(game, latestRows.results ?? []);
    const awayP = num(consensus.awayWinProbability);
    const homeP = num(consensus.homeWinProbability);
    if (awayP === null || homeP === null) continue;
    const favoriteAway = awayP >= homeP;
    const predicted = favoriteAway ? awayP : homeP;
    const actualWinner = Number(game.away_score) > Number(game.home_score) ? "AWAY" : "HOME";
    const won = (favoriteAway ? "AWAY" : "HOME") === actualWinner;
    const key = calibrationBucket(predicted);
    const bucket = buckets.get(key) ?? { bucket: key, count: 0, wins: 0, predicted: [] };
    bucket.count += 1;
    if (won) bucket.wins += 1;
    bucket.predicted.push(predicted);
    buckets.set(key, bucket);
  }
  const order = ["50–59.9%", "60–69.9%", "70–79.9%", "80–89.9%", "90%+"];
  return order.map((key) => buckets.get(key)).filter(Boolean).map((b) => ({
    bucket: b.bucket,
    count: b.count,
    predictedRate: round1(average(b.predicted)),
    actualWinRate: round1((b.wins / b.count) * 100)
  }));
}

export async function survivorAnalytics(db, season, week) {
  if (!db) throw new Error("Database is not bound");
  await ensureMarketSchema(db);
  const seasonNumber = Number(season);
  const weekNumber = Number(week);
  if (!Number.isInteger(seasonNumber) || !Number.isInteger(weekNumber)) throw new Error("Season and week must be integers");

  const [{ entries, picks }, boardResult, futures] = await Promise.all([
    entriesAndPicks(db, seasonNumber),
    survivorRecommendations(db, seasonNumber, weekNumber, null),
    futureMarkets(db, seasonNumber, weekNumber)
  ]);
  const baseBoard = boardResult.candidates ?? [];
  const marketByGame = await currentMarketDetails(db, baseBoard);

  const currentPicks = {};
  const exposureByTeam = {};
  const entryModels = [];
  for (const entry of entries) {
    const history = picks.filter((p) => Number(p.entry_id) === Number(entry.id)).map((p) => ({
      week: Number(p.week), team: p.team, gameId: p.game_id, outcome: pickOutcome(p)
    }));
    const current = history.find((p) => p.week === weekNumber) ?? null;
    currentPicks[entry.id] = current;
    if (current) exposureByTeam[current.team] = (exposureByTeam[current.team] ?? 0) + 1;
    const priorUsed = new Set(history.filter((p) => p.week < weekNumber).map((p) => p.team));
    const availableBoard = baseBoard.map((c) => ({ ...c, available: !priorUsed.has(c.team), used: priorUsed.has(c.team) }));
    const available = availableBoard.filter((c) => c.available).sort((a, b) => b.winProbability - a.winProbability);
    entryModels.push({
      id: Number(entry.id), name: entry.name, currentPick: current, history,
      priorUsedTeams: [...priorUsed],
      availableCount: available.length,
      remainingStrength: {
        topProbability: available[0]?.winProbability ?? null,
        top5Average: round1(average(available.slice(0, 5).map((c) => c.winProbability)))
      }
    });
  }

  const board = baseBoard.map((candidate) => {
    const market = marketByGame.get(candidate.gameId);
    const sideKey = candidate.side === "AWAY" ? "awayWinProbability" : "homeWinProbability";
    const firstP = num(market?.first?.[sideKey]);
    const latestP = num(market?.latest?.[sideKey]);
    const latestBookProbabilities = (market?.latest?.books ?? []).map((book) => candidate.side === "AWAY" ? book.awayWinProbability * 100 : book.homeWinProbability * 100);
    const agreement = marketAgreement(latestBookProbabilities);
    const futureValue = futureValueForTeam(candidate.team, futures);
    const availableEntries = entryModels.filter((entry) => !entry.priorUsedTeams.includes(candidate.team)).length;
    return {
      ...candidate,
      availableEntries,
      totalEntries: entryModels.length,
      exposure: exposureByTeam[candidate.team] ?? 0,
      marketAgreement: agreement,
      movement: {
        firstProbability: firstP,
        currentProbability: latestP,
        change: firstP === null || latestP === null ? null : round1(latestP - firstP)
      },
      futureValue,
      riskContext: {
        homeAway: candidate.side,
        marketAgreement: agreement.label,
        movementDirection: firstP === null || latestP === null ? "Unavailable" : latestP > firstP ? "Strengthening" : latestP < firstP ? "Weakening" : "Flat"
      }
    };
  });

  const entryStrategies = entryModels.map((entry) => {
    const eligible = board.filter((c) => !entry.priorUsedTeams.includes(c.team)).sort((a, b) => b.winProbability - a.winProbability);
    const safest = eligible[0] ?? null;
    const alternative = eligible[1] ?? null;
    return {
      entryId: entry.id,
      safest,
      bestStrategicValue: chooseStrategicCandidate(eligible, exposureByTeam),
      alternativeDrop: alternativeDrop(safest?.winProbability, alternative?.winProbability),
      alternativeTeam: alternative?.team ?? null,
      alternativeProbability: alternative?.winProbability ?? null
    };
  });

  return {
    season: seasonNumber,
    week: weekNumber,
    generatedAt: new Date().toISOString(),
    entries: entryModels,
    currentPicks,
    exposureByTeam,
    board,
    entryStrategies,
    futureData: {
      horizonWeeks: 5,
      rowsAvailable: futures.length,
      note: futures.length ? "Future value uses only stored sportsbook markets returned by the existing Odds API calls." : "No future sportsbook markets are stored yet; future value is intentionally unavailable rather than estimated."
    },
    calibration: await calibration(db, seasonNumber, weekNumber)
  };
}
