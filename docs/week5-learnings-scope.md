# Week 5 Learnings and Scoped Changes

## Dashboard trends
- Show at least four trend lines/cards.
- Keep A, B, and C tier trend views.
- Add a Momentum Watch view for categories that do not yet meet the qualification threshold but are strengthening week over week.
- Momentum Watch should show recent weekly direction, current rate, prior rate, delta, and sample size.
- Do not hide a category simply because it is still below threshold if its trajectory is improving.

## Live Edge
Week 5 exposed two different live opportunities that must be treated separately:

1. Scoreboard Distortion
   - Trailing team is playing better than the score suggests.
   - Check turnovers, defensive/special-teams scores, explosives, missed kicks, red-zone failures, field position, and penalties.

2. State Reversal / Acceleration
   - Team may have played poorly earlier but is clearly improving now.
   - Compare the last 2-3 drives with full-game numbers.
   - A previous PASS must reopen automatically after a score, turnover, major possession change, or material shift in recent efficiency.

Required Live Edge behavior:
- Weight recent-drive efficiency separately from full-game efficiency.
- Track yards/play, first downs, scoring opportunities, pressure/sacks, turnovers, red-zone finishing, possession quality, and field position.
- Do not confuse play volume or time of possession with superiority.
- Add explicit invalidation rules when the opponent begins sustaining efficient scoring drives, the trailing offense repeatedly fails to finish, time/possessions collapse, or an injury changes the premise.
- Keep Brain as the pregame anchor, Live Edge as current-game evidence, and historical context as secondary confirmation only.
- Do not issue ATTACK without a verified executable live price.

Week 5 examples:
- Rams pattern: scoreboard distortion was correctly identified.
- Giants: missed state reversal because cumulative stats were weighted too heavily and the prior PASS was not reopened quickly enough.
- Colts: false positive caused by overweighting possession/play volume and underweighting efficiency and drive finishing.
- Saints: correct thesis break.
- Seattle: turnover-driven deficit created a live-spread opportunity that should have been surfaced more aggressively.
- Chargers: looked attractive mid-game but needed faster invalidation when the fourth-quarter game state changed.
- Arizona: should have been downgraded sooner.

## Weekly Picks Pool
The weekly picks pool needs a separate objective from ATS betting.

Goal: maximize outright winners across the full slate.

Add a separate Win Probability / Pool Edge model using:
- moneyline / no-vig win probability
- spread and line movement
- injuries / availability
- matchup and team-quality context
- Brain context where relevant
- public / majority pick percentage when available

Classify each game as:
- Safe Favorite
- Lean
- Coin Flip
- Upset Opportunity

Pool strategy:
- Do not make contrarian picks just to be different.
- Protect high-confidence favorites.
- Take an upset only when our estimated win probability is meaningfully better than the public expectation.
- Surface where the user is following the field versus where the pick creates useful leverage.

Primary question for the Picks screen:
> Who is most likely to win this game outright, and where do we have an edge over everyone else?

## Product requirement
Dashboard, Live Edge, and Weekly Picks are separate decision systems:
- Dashboard = ATS trend discovery
- Live Edge = in-game spread/ML repricing and reversal detection
- Weekly Picks = outright winner accuracy and pool leverage

Do not allow one model's objective to substitute for another.
