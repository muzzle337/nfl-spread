import { fetchNflverseWeek, teamCode } from "./context-sources.js";
import { ingestCompletedScores } from "./results.js";

const CODE_ALIASES = Object.freeze({ LA: "LAR", JAC: "JAX", OAK: "LV", SD: "LAC", STL: "LAR" });

function canonicalTeam(value) {
  const code = teamCode(value);
  return CODE_ALIASES[code] ?? code;
}

function scoreOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 ? score : null;
}

export function finalFromNflverseRow(row, storedGame) {
  const awayScore = scoreOrNull(row?.away_score ?? row?.awayScore);
  const homeScore = scoreOrNull(row?.home_score ?? row?.homeScore);
  if (awayScore === null || homeScore === null) return null;
  if (canonicalTeam(row?.away_team ?? row?.awayTeam) !== canonicalTeam(storedGame?.away_team ?? storedGame?.awayTeam)) return null;
  if (canonicalTeam(row?.home_team ?? row?.homeTeam) !== canonicalTeam(storedGame?.home_team ?? storedGame?.homeTeam)) return null;
  return {
    id: storedGame.id,
    completed: true,
    awayTeam: storedGame.away_team ?? storedGame.awayTeam,
    homeTeam: storedGame.home_team ?? storedGame.homeTeam,
    commenceTime: storedGame.kickoff_at ?? storedGame.kickoffAt ?? null,
    awayScore,
    homeScore,
    source: "nflverse"
  };
}

export async function repairMissingFinalsFromNflverse({ db, missingGames, fetchWeek = fetchNflverseWeek }) {
  if (!db) throw new Error("Database is not bound");
  const rows = Array.isArray(missingGames) ? missingGames : [];
  if (!rows.length) return { attempted: 0, candidates: 0, repaired: 0, unresolved: 0, ingestion: null, source: "nflverse" };

  const byWeek = new Map();
  for (const game of rows) {
    const season = Number(game.season);
    const week = Number(game.week);
    if (!Number.isInteger(season) || !Number.isInteger(week)) continue;
    const key = `${season}|${week}`;
    if (!byWeek.has(key)) byWeek.set(key, { season, week, games: [] });
    byWeek.get(key).games.push(game);
  }

  const finalEvents = [];
  let attempted = 0;
  for (const group of byWeek.values()) {
    attempted += group.games.length;
    const sourceRows = await fetchWeek(group.season, group.week);
    for (const game of group.games) {
      const matched = (sourceRows ?? []).find((row) =>
        canonicalTeam(row.away_team ?? row.awayTeam) === canonicalTeam(game.away_team ?? game.awayTeam)
        && canonicalTeam(row.home_team ?? row.homeTeam) === canonicalTeam(game.home_team ?? game.homeTeam)
      );
      const final = matched ? finalFromNflverseRow(matched, game) : null;
      if (final) finalEvents.push(final);
    }
  }

  const ingestion = finalEvents.length ? await ingestCompletedScores(db, finalEvents) : null;
  return {
    attempted,
    candidates: finalEvents.length,
    repaired: Number(ingestion?.gamesUpdated ?? 0),
    unchanged: Number(ingestion?.gamesUnchanged ?? 0),
    unresolved: Math.max(0, attempted - finalEvents.length),
    ingestion,
    source: "nflverse"
  };
}
