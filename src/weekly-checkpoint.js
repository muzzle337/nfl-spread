// v0.25.5 read-only weekly checkpoint. Uses stored game and signal data only.
// No provider calls, schema changes, cron jobs or automatic writes.
export function weeklyCheckpoint({ season, week, games = [], picks = [], snapshots = [] }) {
  const pickByGame = new Map(picks.map(p => [String(p.gameId), p.team]));
  const snapshotByGame = new Map(snapshots.map(s => [String(s.gameId), s]));
  const counts = { scheduled: 0, final: 0, upcoming: 0, live: 0, picked: 0,
    unpicked: 0, correct: 0, wrong: 0, tied: 0, pending: 0, frozenSignals: 0 };
  const details = [];
  for (const game of games) {
    const id = String(game.id);
    const pick = pickByGame.get(id) ?? null;
    const frozen = snapshotByGame.has(id);
    const final = game.status === 'COMPLETED' &&
      Number.isFinite(Number(game.away_score)) && game.away_score !== null &&
      Number.isFinite(Number(game.home_score)) && game.home_score !== null;
    const started = !final && game.kickoff_at && Date.parse(game.kickoff_at) <= Date.now();
    let result = null;
    if (final && pick) {
      const away = Number(game.away_score), home = Number(game.home_score);
      result = away === home ? 'TIE' :
        pick === (away > home ? game.away_team : game.home_team) ? 'CORRECT' : 'WRONG';
    }
    counts.scheduled++;
    if (final) counts.final++;
    else if (started) counts.live++;
    else counts.upcoming++;
    if (pick) counts.picked++;
    else counts.unpicked++;
    if (frozen) counts.frozenSignals++;
    if (result === 'CORRECT') counts.correct++;
    else if (result === 'WRONG') counts.wrong++;
    else if (result === 'TIE') counts.tied++;
    else if (pick) counts.pending++;
    details.push({ gameId: id, pick, final, result, frozenSignal: frozen });
  }
  return {
    season, week, counts, games: details,
    // A final score is required for every scheduled game; tied picks are excluded from accuracy.
    complete: counts.scheduled > 0 && counts.final === counts.scheduled,
    pickAccuracy: counts.correct + counts.wrong
      ? Math.round(counts.correct / (counts.correct + counts.wrong) * 1000) / 10 : null
  };
}
