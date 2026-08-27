export const TIERS = Object.freeze({ PICK_EM: "PICK_EM", LE_3: "<=3", LE_7: "<=7", GT_7: ">7" });

export function tierForSpread(spread) {
  const n = Math.abs(Number(spread));
  if (!Number.isFinite(n)) throw new Error("Spread must be numeric");
  if (n === 0) return TIERS.PICK_EM;
  if (n <= 3) return TIERS.LE_3;
  if (n <= 7) return TIERS.LE_7;
  return TIERS.GT_7;
}

export function classifyGame(awaySpread, homeSpread) {
  const away = Number(awaySpread);
  const home = Number(homeSpread);
  if (!Number.isFinite(away) || !Number.isFinite(home)) throw new Error("Both spreads are required");
  if (Math.abs(away + home) > 0.011) throw new Error("Spread mismatch");
  if (away === 0 && home === 0) return { away: "AwayPickEm", home: "HomePickEm", tier: TIERS.PICK_EM };
  const tier = tierForSpread(away);
  return away < 0
    ? { away: "AwayFav", home: "HomeDog", tier }
    : { away: "AwayDog", home: "HomeFav", tier };
}

export function settleAgainstSpread({ awaySpread, homeSpread, awayScore, homeScore }) {
  const classification = classifyGame(awaySpread, homeSpread);
  const awayAdjusted = Number(awayScore) + Number(awaySpread);
  const homeAdjusted = Number(homeScore) + Number(homeSpread);
  if (![awayAdjusted, homeAdjusted].every(Number.isFinite)) throw new Error("Final scores are required");
  if (awayAdjusted === homeAdjusted) return { result: "PUSH", coveringSide: "Push", ...classification };
  const awayCovered = awayAdjusted > homeAdjusted;
  const favoriteIsAway = Number(awaySpread) < 0;
  const favoriteCovered = awayCovered === favoriteIsAway;
  return {
    result: favoriteCovered ? "FAVORITE" : "UNDERDOG",
    coveringSide: awayCovered ? "Away" : "Home",
    ...classification
  };
}

export function focusGrade(rate) {
  const pct = Number(rate);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new Error("Rate must be 0-100");
  if (pct >= 70) return "A";
  if (pct >= 60) return "B";
  if (pct >= 55) return "C";
  return null;
}
