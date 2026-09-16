const ALIASES = Object.freeze({ LA: "LAR", JAC: "JAX", OAK: "LV", SD: "LAC", STL: "LAR" });
const NAMES = Object.freeze({
  "ARIZONA CARDINALS":"ARI","ATLANTA FALCONS":"ATL","BALTIMORE RAVENS":"BAL","BUFFALO BILLS":"BUF",
  "CAROLINA PANTHERS":"CAR","CHICAGO BEARS":"CHI","CINCINNATI BENGALS":"CIN","CLEVELAND BROWNS":"CLE",
  "DALLAS COWBOYS":"DAL","DENVER BRONCOS":"DEN","DETROIT LIONS":"DET","GREEN BAY PACKERS":"GB",
  "HOUSTON TEXANS":"HOU","INDIANAPOLIS COLTS":"IND","JACKSONVILLE JAGUARS":"JAX","KANSAS CITY CHIEFS":"KC",
  "LAS VEGAS RAIDERS":"LV","LOS ANGELES CHARGERS":"LAC","LOS ANGELES RAMS":"LAR","MIAMI DOLPHINS":"MIA",
  "MINNESOTA VIKINGS":"MIN","NEW ENGLAND PATRIOTS":"NE","NEW ORLEANS SAINTS":"NO","NEW YORK GIANTS":"NYG",
  "NEW YORK JETS":"NYJ","PHILADELPHIA EAGLES":"PHI","PITTSBURGH STEELERS":"PIT","SAN FRANCISCO 49ERS":"SF",
  "SEATTLE SEAHAWKS":"SEA","TAMPA BAY BUCCANEERS":"TB","TENNESSEE TITANS":"TEN","WASHINGTON COMMANDERS":"WAS"
});

export function canonicalTeamCode(value) {
  const clean = String(value ?? "").trim().toUpperCase();
  return NAMES[clean] ?? ALIASES[clean] ?? clean;
}

function publicTeam(game, side) {
  return game?.[`${side}Team`] ?? game?.[`${side}_team`] ?? null;
}

function gameQuality(game) {
  const books = Number(game?.bookmakerCount ?? game?.bookmaker_count ?? 0);
  const completed = String(game?.status ?? "").toUpperCase() === "COMPLETED" ? 1000 : 0;
  const final = (game?.awayScore ?? game?.away_score) != null && (game?.homeScore ?? game?.home_score) != null ? 500 : 0;
  let naming = 0;
  for (const side of ["away", "home"]) {
    const raw = String(publicTeam(game,side) ?? "").trim().toUpperCase();
    if (ALIASES[raw]) naming -= 50;
    else if (NAMES[raw]) naming += 4;
    else if (canonicalTeamCode(raw) === raw) naming += 2;
  }
  return completed + final + books * 10 + naming;
}

export function dedupeCanonicalMatchups(games) {
  const selected = new Map();
  for (const game of Array.isArray(games) ? games : []) {
    const away = canonicalTeamCode(publicTeam(game, "away"));
    const home = canonicalTeamCode(publicTeam(game, "home"));
    const season = game?.season ?? "";
    const week = game?.week ?? "";
    const key = `${season}|${week}|${away}|${home}`;
    const current = selected.get(key);
    if (!current || gameQuality(game) > gameQuality(current)) selected.set(key, game);
  }
  return [...selected.values()];
}
