import { ensureContextSchema } from "./context-schema.js";
import {
  fetchKickoffWeather,
  fetchNfldataGames,
  fetchNfldataTeamStats,
  fetchNflverseWeek,
  mergeContextGame,
  normalizeScheduleRow,
  normalizeTeamMetric,
  teamCode
} from "./context-sources.js";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round1(value) {
  const n = finite(value);
  return n === null ? null : Math.round(n * 10) / 10;
}

async function storedGames(db, season, week) {
  const result = await db.prepare(`
    SELECT id, season, week, away_team, home_team, kickoff_at, status, away_score, home_score
    FROM games
    WHERE season = ? AND week = ? AND season_type = 'REGULAR'
    ORDER BY kickoff_at ASC, id ASC
  `).bind(season, week).all();
  return result.results ?? [];
}

function sourceMatch(rows, game) {
  const away = teamCode(game.away_team);
  const home = teamCode(game.home_team);
  return rows.find((row) => {
    const n = normalizeScheduleRow(row);
    return n.awayTeam === away && n.homeTeam === home;
  }) ?? null;
}

async function upsertContextGame(db, game, context) {
  await db.prepare(`
    INSERT INTO context_games(
      game_id, season, week, stadium, location, roof, surface,
      away_rest, home_rest, away_coach, home_coach, away_qb, home_qb,
      nflverse_game_id, nfldata_game_id, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(game_id) DO UPDATE SET
      stadium=excluded.stadium, location=excluded.location, roof=excluded.roof, surface=excluded.surface,
      away_rest=excluded.away_rest, home_rest=excluded.home_rest,
      away_coach=excluded.away_coach, home_coach=excluded.home_coach,
      away_qb=excluded.away_qb, home_qb=excluded.home_qb,
      nflverse_game_id=excluded.nflverse_game_id, nfldata_game_id=excluded.nfldata_game_id,
      synced_at=CURRENT_TIMESTAMP
  `).bind(
    game.id, game.season, game.week, context.stadium, context.location, context.roof, context.surface,
    context.awayRest, context.homeRest, context.awayCoach, context.homeCoach, context.awayQb, context.homeQb,
    context.nflverseGameId, context.nfldataGameId
  ).run();
}

async function upsertWeather(db, gameId, weather) {
  if (!weather) return false;
  await db.prepare(`
    INSERT INTO context_weather(
      game_id, forecast_for, temperature_f, apparent_temperature_f,
      precipitation_probability, precipitation_in, snowfall_in,
      wind_mph, gust_mph, weather_code, source, fetched_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open-meteo', CURRENT_TIMESTAMP)
    ON CONFLICT(game_id) DO UPDATE SET
      forecast_for=excluded.forecast_for, temperature_f=excluded.temperature_f,
      apparent_temperature_f=excluded.apparent_temperature_f,
      precipitation_probability=excluded.precipitation_probability,
      precipitation_in=excluded.precipitation_in, snowfall_in=excluded.snowfall_in,
      wind_mph=excluded.wind_mph, gust_mph=excluded.gust_mph,
      weather_code=excluded.weather_code, source='open-meteo', fetched_at=CURRENT_TIMESTAMP
  `).bind(
    gameId, weather.forecastFor, weather.temperatureF, weather.apparentTemperatureF,
    weather.precipitationProbability, weather.precipitationIn, weather.snowfallIn,
    weather.windMph, weather.gustMph, weather.weatherCode
  ).run();
  return true;
}

async function recordFromStoredResults(db, season, week, team) {
  const code = teamCode(team);
  const result = await db.prepare(`
    SELECT away_team, home_team, away_score, home_score
    FROM games
    WHERE season = ? AND week <= ? AND season_type = 'REGULAR' AND status = 'COMPLETED'
      AND away_score IS NOT NULL AND home_score IS NOT NULL
  `).bind(season, week).all();
  let wins = 0, losses = 0, ties = 0, pointsFor = 0, pointsAgainst = 0;
  for (const game of result.results ?? []) {
    const away = teamCode(game.away_team), home = teamCode(game.home_team);
    if (away !== code && home !== code) continue;
    const pf = away === code ? Number(game.away_score) : Number(game.home_score);
    const pa = away === code ? Number(game.home_score) : Number(game.away_score);
    pointsFor += pf; pointsAgainst += pa;
    if (pf > pa) wins += 1; else if (pf < pa) losses += 1; else ties += 1;
  }
  return { wins, losses, ties, pointsFor, pointsAgainst, pointDiff: pointsFor - pointsAgainst };
}

async function upsertTeamMetrics(db, season, week, sourceRows, teams) {
  const normalizedRows = sourceRows.map(normalizeTeamMetric).filter((r) => r.team);
  let count = 0;
  for (const team of teams) {
    const code = teamCode(team);
    const source = normalizedRows.find((r) => r.team === code) ?? {};
    const record = await recordFromStoredResults(db, season, week, code);
    await db.prepare(`
      INSERT INTO context_team_metrics(
        season, week, team, wins, losses, ties, points_for, points_against, point_diff,
        offensive_epa, defensive_epa, success_rate, source, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nfldata+d1', CURRENT_TIMESTAMP)
      ON CONFLICT(season, week, team, source) DO UPDATE SET
        wins=excluded.wins, losses=excluded.losses, ties=excluded.ties,
        points_for=excluded.points_for, points_against=excluded.points_against, point_diff=excluded.point_diff,
        offensive_epa=excluded.offensive_epa, defensive_epa=excluded.defensive_epa,
        success_rate=excluded.success_rate, synced_at=CURRENT_TIMESTAMP
    `).bind(
      season, week, code, record.wins, record.losses, record.ties,
      record.pointsFor, record.pointsAgainst, record.pointDiff,
      source.offensiveEpa ?? null, source.defensiveEpa ?? null, source.successRate ?? null
    ).run();
    count += 1;
  }
  return count;
}

export async function syncContext(db, season, week, { fetchImpl = fetch } = {}) {
  if (!db) throw new Error("Database is not bound");
  await ensureContextSchema(db);
  const games = await storedGames(db, season, week);
  if (!games.length) throw new Error("No stored games for this week. Update Lines first.");

  let nflverseRows = [], nfldataGames = [], nfldataStats = [];
  let nflverseOk = false, nfldataOk = false, weatherOk = false;
  const errors = [];

  try { nflverseRows = await fetchNflverseWeek(season, week, fetchImpl); nflverseOk = true; }
  catch (error) { errors.push(`nflverse: ${error.message}`); }
  try {
    [nfldataGames, nfldataStats] = await Promise.all([
      fetchNfldataGames(season, week, fetchImpl),
      fetchNfldataTeamStats(season, week, fetchImpl)
    ]);
    nfldataOk = true;
  } catch (error) { errors.push(`nfldata: ${error.message}`); }

  let gamesUpdated = 0, weatherUpdated = 0;
  const teams = new Set();
  for (const game of games) {
    teams.add(teamCode(game.away_team)); teams.add(teamCode(game.home_team));
    const context = mergeContextGame(sourceMatch(nflverseRows, game), sourceMatch(nfldataGames, game));
    await upsertContextGame(db, game, context);
    gamesUpdated += 1;
    try {
      const weather = await fetchKickoffWeather({
        homeTeam: game.home_team,
        location: context.location,
        kickoffAt: game.kickoff_at,
        fetchImpl
      });
      if (await upsertWeather(db, game.id, weather)) weatherUpdated += 1;
      weatherOk = true;
    } catch (error) { errors.push(`weather ${game.id}: ${error.message}`); }
  }

  await upsertTeamMetrics(db, season, week, nfldataStats, [...teams]);
  await db.prepare(`
    INSERT INTO context_sync_runs(season, week, nfldata_ok, nflverse_ok, weather_ok, games_updated, weather_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(season, week, nfldataOk ? 1 : 0, nflverseOk ? 1 : 0, weatherOk ? 1 : 0, gamesUpdated, weatherUpdated).run();

  return { season, week, gamesUpdated, weatherUpdated, sources: { nfldata: nfldataOk, nflverse: nflverseOk, openMeteo: weatherOk }, errors };
}

function makeObservation(kind, label, detail, side = null) {
  return { kind, label, detail, side };
}

export function buildContextObservations(game) {
  const out = [];
  const w = game.weather ?? {};
  if (finite(w.windMph) !== null && w.windMph >= 15) out.push(makeObservation("warning", "Wind", `${round1(w.windMph)} mph at kickoff`));
  if (finite(w.gustMph) !== null && w.gustMph >= 25) out.push(makeObservation("warning", "Gusts", `Up to ${round1(w.gustMph)} mph`));
  if (finite(w.precipitationProbability) !== null && w.precipitationProbability >= 40) out.push(makeObservation("warning", "Precipitation", `${Math.round(w.precipitationProbability)}% chance`));
  if (finite(w.temperatureF) !== null && w.temperatureF <= 32) out.push(makeObservation("interesting", "Cold", `${Math.round(w.temperatureF)}°F at kickoff`));
  if (finite(w.temperatureF) !== null && w.temperatureF >= 90) out.push(makeObservation("interesting", "Heat", `${Math.round(w.temperatureF)}°F at kickoff`));

  const restDiff = finite(game.homeRest) !== null && finite(game.awayRest) !== null ? game.homeRest - game.awayRest : null;
  if (restDiff !== null && Math.abs(restDiff) >= 3) {
    const side = restDiff > 0 ? "HOME" : "AWAY";
    out.push(makeObservation("supporting", "Rest edge", `${Math.abs(restDiff)} more rest days`, side));
  }

  const away = game.awayMetrics ?? {}, home = game.homeMetrics ?? {};
  if (finite(away.pointDiff) !== null && finite(home.pointDiff) !== null && Math.abs(away.pointDiff - home.pointDiff) >= 30) {
    const side = away.pointDiff > home.pointDiff ? "AWAY" : "HOME";
    out.push(makeObservation("interesting", "Point differential", `${game.awayCode} ${away.pointDiff >= 0 ? "+" : ""}${away.pointDiff} · ${game.homeCode} ${home.pointDiff >= 0 ? "+" : ""}${home.pointDiff}`, side));
  }
  if (finite(away.offensiveEpa) !== null && finite(home.offensiveEpa) !== null && Math.abs(away.offensiveEpa - home.offensiveEpa) >= 0.08) {
    const side = away.offensiveEpa > home.offensiveEpa ? "AWAY" : "HOME";
    out.push(makeObservation("interesting", "Offensive EPA gap", `${round1(Math.abs(away.offensiveEpa - home.offensiveEpa))} EPA/play difference`, side));
  }

  if (!out.length && (game.stadium || game.roof || game.surface)) out.push(makeObservation("neutral", "Venue", [game.stadium, game.roof, game.surface].filter(Boolean).join(" · ")));
  return out.slice(0, 5);
}

export async function contextForWeek(db, season, week) {
  if (!db) throw new Error("Database is not bound");
  await ensureContextSchema(db);
  const games = await storedGames(db, season, week);
  const contextRows = await db.prepare(`SELECT * FROM context_games WHERE season = ? AND week = ?`).bind(season, week).all();
  const metricsRows = await db.prepare(`SELECT * FROM context_team_metrics WHERE season = ? AND week = ?`).bind(season, week).all();
  const weatherRows = await db.prepare(`
    SELECT w.* FROM context_weather w JOIN games g ON g.id = w.game_id WHERE g.season = ? AND g.week = ?
  `).bind(season, week).all();
  const sync = await db.prepare(`SELECT * FROM context_sync_runs WHERE season = ? AND week = ? ORDER BY id DESC LIMIT 1`).bind(season, week).first();

  const contextMap = new Map((contextRows.results ?? []).map((r) => [r.game_id, r]));
  const metricMap = new Map((metricsRows.results ?? []).map((r) => [r.team, r]));
  const weatherMap = new Map((weatherRows.results ?? []).map((r) => [r.game_id, r]));

  const payload = games.map((game) => {
    const c = contextMap.get(game.id) ?? {};
    const awayCode = teamCode(game.away_team), homeCode = teamCode(game.home_team);
    const weatherRow = weatherMap.get(game.id) ?? null;
    const shapeMetric = (r) => r ? {
      wins: finite(r.wins), losses: finite(r.losses), ties: finite(r.ties),
      pointsFor: finite(r.points_for), pointsAgainst: finite(r.points_against), pointDiff: finite(r.point_diff),
      offensiveEpa: finite(r.offensive_epa), defensiveEpa: finite(r.defensive_epa), successRate: finite(r.success_rate)
    } : null;
    const shaped = {
      gameId: game.id, season: game.season, week: game.week, kickoffAt: game.kickoff_at,
      awayTeam: game.away_team, homeTeam: game.home_team, awayCode, homeCode,
      stadium: c.stadium ?? null, location: c.location ?? null, roof: c.roof ?? null, surface: c.surface ?? null,
      awayRest: finite(c.away_rest), homeRest: finite(c.home_rest),
      awayCoach: c.away_coach ?? null, homeCoach: c.home_coach ?? null,
      awayQb: c.away_qb ?? null, homeQb: c.home_qb ?? null,
      awayMetrics: shapeMetric(metricMap.get(awayCode)), homeMetrics: shapeMetric(metricMap.get(homeCode)),
      weather: weatherRow ? {
        forecastFor: weatherRow.forecast_for, temperatureF: finite(weatherRow.temperature_f), apparentTemperatureF: finite(weatherRow.apparent_temperature_f),
        precipitationProbability: finite(weatherRow.precipitation_probability), precipitationIn: finite(weatherRow.precipitation_in),
        snowfallIn: finite(weatherRow.snowfall_in), windMph: finite(weatherRow.wind_mph), gustMph: finite(weatherRow.gust_mph), weatherCode: finite(weatherRow.weather_code)
      } : null
    };
    return { ...shaped, observations: buildContextObservations(shaped) };
  });

  return {
    season: Number(season), week: Number(week), games: payload,
    lastSync: sync ? { at: sync.created_at, sources: { nfldata: !!sync.nfldata_ok, nflverse: !!sync.nflverse_ok, openMeteo: !!sync.weather_ok } } : null,
    principle: "Context surfaces things to notice. It does not change spread or Survivor probabilities."
  };
}
