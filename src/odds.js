const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const NFL_SPORT_KEY = "americanfootball_nfl";

const intHeader = (headers, name) => {
  const raw = headers.get(name);
  if (raw === null || raw === "") return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
};

export function quotaFromHeaders(headers) {
  return {
    creditsUsedTotal: intHeader(headers, "x-requests-used"),
    creditsRemaining: intHeader(headers, "x-requests-remaining"),
    creditsUsedThisRequest: intHeader(headers, "x-requests-last")
  };
}

function buildNflOddsUrl(apiKey, markets) {
  if (!apiKey) throw new Error("ODDS_API_KEY is not configured");
  const url = new URL(`${ODDS_API_BASE}/sports/${NFL_SPORT_KEY}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", markets.join(","));
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("dateFormat", "iso");
  return url;
}

export function buildNflSpreadsUrl(apiKey) {
  return buildNflOddsUrl(apiKey, ["spreads"]);
}

export function buildNflMarketsUrl(apiKey) {
  return buildNflOddsUrl(apiKey, ["spreads", "h2h"]);
}

export function buildNflScoresUrl(apiKey, daysFrom = 3) {
  if (!apiKey) throw new Error("ODDS_API_KEY is not configured");
  const days = Number(daysFrom);
  if (!Number.isInteger(days) || days < 1 || days > 3) {
    throw new Error("daysFrom must be an integer from 1 to 3");
  }

  const url = new URL(`${ODDS_API_BASE}/sports/${NFL_SPORT_KEY}/scores`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("daysFrom", String(days));
  url.searchParams.set("dateFormat", "iso");
  return url;
}

function normalizedBookmaker(event, bookmaker) {
  const markets = bookmaker.markets ?? [];
  const spreadMarket = markets.find((item) => item.key === "spreads");
  const moneylineMarket = markets.find((item) => item.key === "h2h");

  const spreadAway = (spreadMarket?.outcomes ?? []).find((outcome) => outcome.name === event.away_team);
  const spreadHome = (spreadMarket?.outcomes ?? []).find((outcome) => outcome.name === event.home_team);
  const awaySpread = Number(spreadAway?.point);
  const homeSpread = Number(spreadHome?.point);

  const moneylineAway = (moneylineMarket?.outcomes ?? []).find((outcome) => outcome.name === event.away_team);
  const moneylineHome = (moneylineMarket?.outcomes ?? []).find((outcome) => outcome.name === event.home_team);
  const awayMoneyline = Number(moneylineAway?.price);
  const homeMoneyline = Number(moneylineHome?.price);

  const hasSpread = Number.isFinite(awaySpread) && Number.isFinite(homeSpread);
  const hasMoneyline = Number.isFinite(awayMoneyline) && Number.isFinite(homeMoneyline);
  if (!hasSpread && !hasMoneyline) return null;

  return {
    key: bookmaker.key,
    title: bookmaker.title,
    lastUpdate: moneylineMarket?.last_update ?? spreadMarket?.last_update ?? bookmaker.last_update ?? null,
    awaySpread: hasSpread ? awaySpread : null,
    homeSpread: hasSpread ? homeSpread : null,
    awayMoneyline: hasMoneyline ? awayMoneyline : null,
    homeMoneyline: hasMoneyline ? homeMoneyline : null
  };
}

export function normalizeNflMarkets(events) {
  if (!Array.isArray(events)) return [];

  return events.map((event) => {
    const books = (event.bookmakers ?? [])
      .map((bookmaker) => normalizedBookmaker(event, bookmaker))
      .filter(Boolean);

    return {
      id: event.id,
      sportKey: event.sport_key,
      commenceTime: event.commence_time,
      awayTeam: event.away_team,
      homeTeam: event.home_team,
      bookmakerCount: books.length,
      books
    };
  });
}

export function normalizeNflSpreads(events) {
  return normalizeNflMarkets(events).map((game) => ({
    ...game,
    books: game.books.filter((book) => Number.isFinite(book.awaySpread) && Number.isFinite(book.homeSpread)).map((book) => ({
      key: book.key,
      title: book.title,
      lastUpdate: book.lastUpdate,
      awaySpread: book.awaySpread,
      homeSpread: book.homeSpread
    }))
  })).map((game) => ({ ...game, bookmakerCount: game.books.length }));
}

export function normalizeNflScores(events) {
  if (!Array.isArray(events)) return [];

  return events.map((event) => {
    const scores = Array.isArray(event.scores) ? event.scores : [];
    const away = scores.find((score) => score.name === event.away_team);
    const home = scores.find((score) => score.name === event.home_team);
    const awayScore = away?.score === null || away?.score === undefined || away?.score === ""
      ? null
      : Number(away.score);
    const homeScore = home?.score === null || home?.score === undefined || home?.score === ""
      ? null
      : Number(home.score);

    return {
      id: event.id,
      sportKey: event.sport_key,
      commenceTime: event.commence_time,
      awayTeam: event.away_team,
      homeTeam: event.home_team,
      completed: event.completed === true,
      awayScore: Number.isFinite(awayScore) ? awayScore : null,
      homeScore: Number.isFinite(homeScore) ? homeScore : null,
      lastUpdate: event.last_update ?? null
    };
  });
}

async function fetchOddsApiJson(url, fetchImpl) {
  const response = await fetchImpl(url.toString(), { headers: { accept: "application/json" } });
  const quota = quotaFromHeaders(response.headers);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message || payload?.error || `Odds API request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.quota = quota;
    throw error;
  }

  return { payload, quota };
}

export async function fetchNflSpreads({ apiKey, fetchImpl = fetch }) {
  const url = buildNflSpreadsUrl(apiKey);
  const { payload, quota } = await fetchOddsApiJson(url, fetchImpl);

  return {
    games: normalizeNflSpreads(payload),
    quota
  };
}

export async function fetchNflMarkets({ apiKey, fetchImpl = fetch }) {
  const url = buildNflMarketsUrl(apiKey);
  const { payload, quota } = await fetchOddsApiJson(url, fetchImpl);

  return {
    games: normalizeNflMarkets(payload),
    quota
  };
}

export async function fetchNflScores({ apiKey, daysFrom = 3, fetchImpl = fetch }) {
  const url = buildNflScoresUrl(apiKey, daysFrom);
  const { payload, quota } = await fetchOddsApiJson(url, fetchImpl);

  return {
    games: normalizeNflScores(payload),
    quota
  };
}
