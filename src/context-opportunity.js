function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function signal(kind, label, detail, side = null, weight = 1, source = null) {
  return { kind, label, detail, side, weight, source };
}

function sideCode(game, side) {
  return side === "AWAY" ? game.awayCode : side === "HOME" ? game.homeCode : null;
}

export function buildOpportunity(game) {
  const signals = [];
  const weather = game.weather ?? {};
  const away = game.awayMetrics ?? {};
  const home = game.homeMetrics ?? {};

  const wind = finite(weather.windMph);
  const gust = finite(weather.gustMph);
  const precip = finite(weather.precipitationProbability);
  const temp = finite(weather.temperatureF);
  if (wind !== null && wind >= 15) signals.push(signal("weather", "Wind", `${Math.round(wind)} mph at kickoff`, null, wind >= 20 ? 2 : 1, "Open-Meteo"));
  if (gust !== null && gust >= 25) signals.push(signal("weather", "Gusts", `${Math.round(gust)} mph gusts`, null, gust >= 35 ? 2 : 1, "Open-Meteo"));
  if (precip !== null && precip >= 40) signals.push(signal("weather", "Precipitation", `${Math.round(precip)}% chance`, null, precip >= 65 ? 2 : 1, "Open-Meteo"));
  if (temp !== null && (temp <= 32 || temp >= 90)) signals.push(signal("weather", temp <= 32 ? "Cold" : "Heat", `${Math.round(temp)}°F at kickoff`, null, 1, "Open-Meteo"));

  const awayRest = finite(game.awayRest), homeRest = finite(game.homeRest);
  if (awayRest !== null && homeRest !== null) {
    const diff = homeRest - awayRest;
    if (Math.abs(diff) >= 3) {
      const side = diff > 0 ? "HOME" : "AWAY";
      signals.push(signal("situational", "Rest edge", `${Math.abs(diff)} more rest days for ${sideCode(game, side)}`, side, Math.abs(diff) >= 6 ? 3 : 2, "nflverse/nfldata"));
    }
  }

  const awayPd = finite(away.pointDiff), homePd = finite(home.pointDiff);
  if (awayPd !== null && homePd !== null && Math.abs(awayPd - homePd) >= 30) {
    const side = awayPd > homePd ? "AWAY" : "HOME";
    signals.push(signal("team-quality", "Point differential gap", `${game.awayCode} ${awayPd >= 0 ? "+" : ""}${awayPd} · ${game.homeCode} ${homePd >= 0 ? "+" : ""}${homePd}`, side, Math.abs(awayPd - homePd) >= 60 ? 3 : 2, "D1 results"));
  }

  const awayOff = finite(away.offensiveEpa), homeOff = finite(home.offensiveEpa);
  if (awayOff !== null && homeOff !== null && Math.abs(awayOff - homeOff) >= 0.08) {
    const side = awayOff > homeOff ? "AWAY" : "HOME";
    signals.push(signal("advanced", "Offensive EPA gap", `${Math.abs(awayOff - homeOff).toFixed(3)} EPA/play`, side, Math.abs(awayOff - homeOff) >= 0.15 ? 3 : 2, "nfldata"));
  }

  const awayDef = finite(away.defensiveEpa), homeDef = finite(home.defensiveEpa);
  if (awayDef !== null && homeDef !== null && Math.abs(awayDef - homeDef) >= 0.08) {
    const side = awayDef < homeDef ? "AWAY" : "HOME";
    signals.push(signal("advanced", "Defensive EPA gap", `${Math.abs(awayDef - homeDef).toFixed(3)} EPA/play`, side, Math.abs(awayDef - homeDef) >= 0.15 ? 3 : 2, "nfldata"));
  }

  const awaySuccess = finite(away.successRate), homeSuccess = finite(home.successRate);
  if (awaySuccess !== null && homeSuccess !== null) {
    const normalize = (n) => Math.abs(n) <= 1 ? n * 100 : n;
    const a = normalize(awaySuccess), h = normalize(homeSuccess);
    if (Math.abs(a - h) >= 5) {
      const side = a > h ? "AWAY" : "HOME";
      signals.push(signal("advanced", "Success-rate gap", `${Math.abs(a - h).toFixed(1)} percentage points`, side, Math.abs(a - h) >= 10 ? 3 : 2, "nfldata"));
    }
  }

  const sideWeights = { AWAY: 0, HOME: 0 };
  for (const s of signals) if (s.side) sideWeights[s.side] += s.weight;
  const directionalSide = sideWeights.AWAY === sideWeights.HOME ? null : (sideWeights.AWAY > sideWeights.HOME ? "AWAY" : "HOME");
  const directionalWeight = directionalSide ? sideWeights[directionalSide] : 0;
  const opposingWeight = directionalSide === "AWAY" ? sideWeights.HOME : directionalSide === "HOME" ? sideWeights.AWAY : 0;
  const agreement = directionalSide && directionalWeight >= 3 && directionalWeight >= opposingWeight + 2;

  const rawScore = signals.reduce((sum, s) => sum + s.weight, 0);
  const qualityLoaded = Number(game.quality?.loaded ?? 0);
  const qualityTotal = Number(game.quality?.total ?? 9);
  const qualityRatio = qualityTotal > 0 ? qualityLoaded / qualityTotal : 0;
  const level = rawScore >= 7 ? "HIGH" : rawScore >= 4 ? "MEDIUM" : rawScore >= 1 ? "WATCH" : "NONE";
  const confidence = qualityRatio >= 0.75 ? "GOOD" : qualityRatio >= 0.5 ? "PARTIAL" : "LOW";

  return {
    gameId: game.gameId,
    awayCode: game.awayCode,
    homeCode: game.homeCode,
    score: rawScore,
    level,
    confidence,
    quality: { loaded: qualityLoaded, total: qualityTotal },
    directionalSide: agreement ? directionalSide : null,
    directionalTeam: agreement ? sideCode(game, directionalSide) : null,
    directionalWeight,
    opposingWeight,
    signals: signals.sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label)),
    explanation: rawScore === 0 ? "No standout contextual conditions are currently loaded." : agreement ? `${sideCode(game, directionalSide)} has multiple aligned contextual signals.` : "Context has notable conditions, but they do not clearly align to one side."
  };
}

export function buildOpportunityBoard(games = []) {
  return games
    .map(buildOpportunity)
    .filter((o) => o.level !== "NONE")
    .sort((a, b) => b.score - a.score || b.directionalWeight - a.directionalWeight || a.gameId.localeCompare(b.gameId));
}
