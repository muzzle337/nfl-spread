const NFLVERSE_SCHEDULES_CSV = "https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv";
const NFLDATA_BASE = "https://api.nfldata.org/v1";
const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

const TEAM_CODES = Object.freeze({
  "Arizona Cardinals":"ARI","Atlanta Falcons":"ATL","Baltimore Ravens":"BAL","Buffalo Bills":"BUF","Carolina Panthers":"CAR","Chicago Bears":"CHI","Cincinnati Bengals":"CIN","Cleveland Browns":"CLE","Dallas Cowboys":"DAL","Denver Broncos":"DEN","Detroit Lions":"DET","Green Bay Packers":"GB","Houston Texans":"HOU","Indianapolis Colts":"IND","Jacksonville Jaguars":"JAX","Kansas City Chiefs":"KC","Las Vegas Raiders":"LV","Los Angeles Chargers":"LAC","Los Angeles Rams":"LAR","Miami Dolphins":"MIA","Minnesota Vikings":"MIN","New England Patriots":"NE","New Orleans Saints":"NO","New York Giants":"NYG","New York Jets":"NYJ","Philadelphia Eagles":"PHI","Pittsburgh Steelers":"PIT","San Francisco 49ers":"SF","Seattle Seahawks":"SEA","Tampa Bay Buccaneers":"TB","Tennessee Titans":"TEN","Washington Commanders":"WAS"
});

// Approximate current home-stadium coordinates. Weather is intentionally skipped for neutral-site games.
const STADIUM_COORDS = Object.freeze({
  ARI:[33.5276,-112.2626],ATL:[33.7554,-84.4008],BAL:[39.2780,-76.6227],BUF:[42.7738,-78.7870],CAR:[35.2258,-80.8528],CHI:[41.8623,-87.6167],CIN:[39.0954,-84.5160],CLE:[41.5061,-81.6995],DAL:[32.7473,-97.0945],DEN:[39.7439,-105.0201],DET:[42.3400,-83.0456],GB:[44.5013,-88.0622],HOU:[29.6847,-95.4107],IND:[39.7601,-86.1639],JAX:[30.3239,-81.6373],KC:[39.0489,-94.4839],LV:[36.0908,-115.1830],LAC:[33.9535,-118.3392],LAR:[33.9535,-118.3392],MIA:[25.9580,-80.2389],MIN:[44.9738,-93.2581],NE:[42.0909,-71.2643],NO:[29.9511,-90.0812],NYG:[40.8135,-74.0745],NYJ:[40.8135,-74.0745],PHI:[39.9008,-75.1675],PIT:[40.4468,-80.0158],SF:[37.4030,-121.9700],SEA:[47.5952,-122.3316],TB:[27.9759,-82.5033],TEN:[36.1665,-86.7713],WAS:[38.9078,-76.8645]
});

export function teamCode(value) {
  const clean = String(value ?? "").trim();
  return TEAM_CODES[clean] ?? clean.toUpperCase();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) { row.push(field); field = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

export async function fetchNfldataGames(season, week, fetchImpl = fetch) {
  const url = new URL(`${NFLDATA_BASE}/games`);
  url.searchParams.set("season", String(season));
  url.searchParams.set("week", String(week));
  const payload = await fetchJson(url.toString(), fetchImpl);
  return Array.isArray(payload) ? payload : (payload?.data ?? payload?.items ?? []);
}

export async function fetchNfldataTeamStats(season, week, fetchImpl = fetch) {
  const url = new URL(`${NFLDATA_BASE}/stats/team`);
  url.searchParams.set("season", String(season));
  url.searchParams.set("week", String(week));
  const payload = await fetchJson(url.toString(), fetchImpl);
  return Array.isArray(payload) ? payload : (payload?.data ?? payload?.items ?? []);
}

export async function fetchNflverseWeek(season, week, fetchImpl = fetch) {
  const response = await fetchImpl(NFLVERSE_SCHEDULES_CSV, { headers: { accept: "text/csv" } });
  if (!response.ok) throw new Error(`nflverse schedules returned ${response.status}`);
  const rows = parseCsv(await response.text());
  return rows.filter((row) => Number(row.season) === Number(season) && Number(row.week) === Number(week) && String(row.game_type || row.season_type || "REG").toUpperCase().startsWith("REG"));
}

export function normalizeScheduleRow(row) {
  return {
    sourceGameId: row.game_id || row.id || row.gsis || null,
    awayTeam: teamCode(row.away_team || row.awayTeam),
    homeTeam: teamCode(row.home_team || row.homeTeam),
    stadium: row.stadium || row.stadium_name || row.venue || null,
    location: row.location || null,
    roof: row.roof || null,
    surface: row.surface || null,
    awayRest: numberOrNull(row.away_rest ?? row.awayRest),
    homeRest: numberOrNull(row.home_rest ?? row.homeRest),
    awayCoach: row.away_coach || row.awayCoach || null,
    homeCoach: row.home_coach || row.homeCoach || null,
    awayQb: row.away_qb_name || row.away_qb || row.awayQb || null,
    homeQb: row.home_qb_name || row.home_qb || row.homeQb || null
  };
}

export function mergeContextGame(nflverseRow, nfldataRow = {}) {
  const a = normalizeScheduleRow(nflverseRow || {});
  const b = normalizeScheduleRow(nfldataRow || {});
  return {
    awayTeam: a.awayTeam || b.awayTeam,
    homeTeam: a.homeTeam || b.homeTeam,
    stadium: a.stadium || b.stadium,
    location: a.location || b.location,
    roof: a.roof || b.roof,
    surface: a.surface || b.surface,
    awayRest: a.awayRest ?? b.awayRest,
    homeRest: a.homeRest ?? b.homeRest,
    awayCoach: a.awayCoach || b.awayCoach,
    homeCoach: a.homeCoach || b.homeCoach,
    awayQb: a.awayQb || b.awayQb,
    homeQb: a.homeQb || b.homeQb,
    nflverseGameId: a.sourceGameId,
    nfldataGameId: b.sourceGameId
  };
}

export function normalizeTeamMetric(row) {
  const team = teamCode(row.team || row.team_abbr || row.team_name || row.posteam);
  return {
    team,
    offensiveEpa: numberOrNull(row.offensive_epa ?? row.off_epa ?? row.epa_per_play ?? row.epa),
    defensiveEpa: numberOrNull(row.defensive_epa ?? row.def_epa ?? row.defense_epa),
    successRate: numberOrNull(row.success_rate ?? row.offensive_success_rate ?? row.success),
    pointsFor: numberOrNull(row.points_for ?? row.points ?? row.score),
    pointsAgainst: numberOrNull(row.points_against ?? row.opponent_points ?? row.points_allowed)
  };
}

export function stadiumCoordinates(homeTeam, location) {
  if (String(location ?? "Home").toLowerCase() === "neutral") return null;
  return STADIUM_COORDS[teamCode(homeTeam)] ?? null;
}

export async function fetchKickoffWeather({ homeTeam, location, kickoffAt, fetchImpl = fetch }) {
  const coords = stadiumCoordinates(homeTeam, location);
  if (!coords || !kickoffAt) return null;
  const kickoff = new Date(kickoffAt);
  if (Number.isNaN(kickoff.getTime())) return null;
  const hoursAhead = (kickoff.getTime() - Date.now()) / 3600000;
  if (hoursAhead < -1 || hoursAhead > 16 * 24) return null;

  const url = new URL(OPEN_METEO_BASE);
  url.searchParams.set("latitude", String(coords[0]));
  url.searchParams.set("longitude", String(coords[1]));
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("forecast_days", "16");
  url.searchParams.set("hourly", "temperature_2m,apparent_temperature,precipitation_probability,precipitation,snowfall,wind_speed_10m,wind_gusts_10m,weather_code");
  const payload = await fetchJson(url.toString(), fetchImpl);
  const times = payload?.hourly?.time ?? [];
  if (!times.length) return null;
  let bestIndex = -1, bestDelta = Infinity;
  times.forEach((t, i) => {
    const delta = Math.abs(new Date(`${t}Z`).getTime() - kickoff.getTime());
    if (delta < bestDelta) { bestDelta = delta; bestIndex = i; }
  });
  if (bestIndex < 0 || bestDelta > 90 * 60000) return null;
  const h = payload.hourly;
  return {
    forecastFor: times[bestIndex],
    temperatureF: numberOrNull(h.temperature_2m?.[bestIndex]),
    apparentTemperatureF: numberOrNull(h.apparent_temperature?.[bestIndex]),
    precipitationProbability: numberOrNull(h.precipitation_probability?.[bestIndex]),
    precipitationIn: numberOrNull(h.precipitation?.[bestIndex]),
    snowfallIn: numberOrNull(h.snowfall?.[bestIndex]),
    windMph: numberOrNull(h.wind_speed_10m?.[bestIndex]),
    gustMph: numberOrNull(h.wind_gusts_10m?.[bestIndex]),
    weatherCode: numberOrNull(h.weather_code?.[bestIndex])
  };
}
