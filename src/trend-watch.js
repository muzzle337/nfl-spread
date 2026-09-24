const PAIRS = Object.freeze([
  ["AwayFav", "HomeDog"],
  ["AwayDog", "HomeFav"]
]);

const TIERS = Object.freeze(["<=3", "<=7", ">7"]);

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function bucket(pulse, classification, tier) {
  return pulse?.buckets?.[`${classification}|${tier}`] ?? null;
}

function momentum(pulse, classification, tier) {
  return pulse?.momentum?.[`${classification}|${tier}`] ?? [];
}

function momentumRead(rows) {
  const completed = (Array.isArray(rows) ? rows : []).filter((row) => finite(row?.weekly?.coverRate) !== null);
  if (!completed.length) return { status:"NONE", previous:null, current:null, previousWeek:null, currentWeek:null, delta:null };
  const currentRow = completed[completed.length - 1];
  const current = finite(currentRow?.weekly?.coverRate);
  const currentWeek = finite(currentRow?.week);
  if (completed.length === 1) return { status:"NEW", previous:null, current, previousWeek:null, currentWeek, delta:null };
  const previousRow = completed[completed.length - 2];
  const previous = finite(previousRow?.weekly?.coverRate);
  const previousWeek = finite(previousRow?.week);
  const delta = current === null || previous === null ? null : Math.round((current - previous) * 10) / 10;
  const status = delta === null ? "NONE" : delta > 0 ? "STRENGTHENING" : delta < 0 ? "COOLING" : "STABLE";
  return { status, previous, current, previousWeek, currentWeek, delta };
}

function currentMatches(games, classification, tier) {
  return (Array.isArray(games) ? games : []).filter((game) => {
    const c = game?.classification;
    return c?.tier === tier && (c.away === classification || c.home === classification);
  }).map((game) => ({
    gameId:game.id ?? game.gameId,
    awayTeam:game.awayTeam,
    homeTeam:game.homeTeam,
    kickoffAt:game.kickoffAt
  }));
}

export function buildTrendWatch(pulse, games, { minimumRate = 55, limit = 3 } = {}) {
  const candidates = [];
  for (const tier of TIERS) {
    for (const [first, second] of PAIRS) {
      const firstBucket = bucket(pulse, first, tier);
      const secondBucket = bucket(pulse, second, tier);
      const firstRate = finite(firstBucket?.coverRate);
      const secondRate = finite(secondBucket?.coverRate);
      if (firstRate === null && secondRate === null) continue;
      const classification = secondRate !== null && (firstRate === null || secondRate > firstRate) ? second : first;
      const oppositeClassification = classification === first ? second : first;
      const selected = classification === first ? firstBucket : secondBucket;
      const opposite = classification === first ? secondBucket : firstBucket;
      const rate = finite(selected?.coverRate);
      if (rate === null || rate < minimumRate) continue;
      const matches = currentMatches(games, classification, tier);
      candidates.push({
        key:`${classification}|${tier}`,
        classification,
        oppositeClassification,
        tier,
        wins:Number(selected?.wins ?? 0),
        losses:Number(selected?.losses ?? 0),
        pushes:Number(selected?.pushes ?? 0),
        decisions:Number(selected?.decisions ?? 0),
        coverRate:rate,
        oppositeCoverRate:finite(opposite?.coverRate),
        momentum:momentumRead(momentum(pulse, classification, tier)),
        currentWeekMatches:matches,
        currentWeekMatchCount:matches.length
      });
    }
  }
  return candidates
    .sort((a,b) => b.coverRate - a.coverRate || b.decisions - a.decisions || a.key.localeCompare(b.key))
    .slice(0,Math.max(0,Number(limit) || 0));
}
