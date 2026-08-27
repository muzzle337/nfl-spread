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

export function buildNflSpreadsUrl(apiKey) {
  if (!apiKey) throw new Error("ODDS_API_KEY is not configured");
  const url = new URL(`${ODDS_API_BASE}/sports/${NFL_SPORT_KEY}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "spreads");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("dateFormat", "iso");
  return url;
}

export function normalizeNflSpreads(events) {
  if (!Array.isArray(events)) return [];

  return events.map((event) => {
    const books = (event.bookmakers ?? []).flatMap((bookmaker) => {
      const market = (bookmaker.markets ?? []).find((item) => item.key === "spreads");
      if (!market) return [];

      const away = (market.outcomes ?? []).find((outcome) => outcome.name === event.away_team);
      const home = (market.outcomes ?? []).find((outcome) => outcome.name === event.home_team);
      const awaySpread = Number(away?.point);
      const homeSpread = Number(home?.point);
      if (!Number.isFinite(awaySpread) || !Number.isFinite(homeSpread)) return [];

      return [{
        key: bookmaker.key,
        title: bookmaker.title,
        lastUpdate: market.last_update ?? bookmaker.last_update ?? null,
        awaySpread,
        homeSpread
      }];
    });

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

export async function fetchNflSpreads({ apiKey, fetchImpl = fetch }) {
  const url = buildNflSpreadsUrl(apiKey);
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

  return {
    games: normalizeNflSpreads(payload),
    quota
  };
}
