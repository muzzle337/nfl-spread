# NFL Spread Tool

A simple current-season NFL spread dashboard.

**Live app:** https://nfl-spread-api.sanro4.workers.dev/

## What it does

1. **Collects the market** — pulls spread lines from multiple sportsbooks.
2. **Creates a consensus line** — uses the middle of the market instead of trusting one book.
3. **Classifies each game** — home/away, favorite/underdog, and spread tier.
4. **Learns from this season** — completed prior weeks show how each type of team is covering the spread.
5. **Highlights Focus games** — current matchups enter Focus when the matching 2026 pattern is covering **55%+**.

The tool does **not** predict the final score. It finds current games that match patterns from completed games this season.

## Grades

- **A:** 70%+
- **B:** 60–69%
- **C:** 55–59%
- **No grade:** below 55% or there is not enough completed 2026 data yet

There is intentionally no minimum sample-size gate. The app always shows the sample size so the user can judge how much history is behind a percentage.

## Spread tiers

- **PK**
- **0.5–3**
- **3.5–7**
- **7.5+**

## Quick terms

- **Consensus:** the market spread the engine uses
- **Market Range:** lowest to highest current sportsbook spread
- **Tier:** the spread-size bucket
- **Sample:** completed 2026 decisions behind the percentage
- **Focus:** games whose matching current-season pattern is at least 55%

## Line movement

Tap a game to see **First Captured → Current → Close**.

- **First Captured:** median of the first stored line we have from each sportsbook
- **Current:** median of the latest stored line from each sportsbook
- **Close:** the last stored consensus frozen when the result is recorded

The app also shows how many points the consensus moved, which team the market moved toward, how many books changed, and the total number of stored snapshots.

**Important:** First Captured is not guaranteed to be the sportsbook's true opening line. The tool did not begin watching every game at the exact moment each sportsbook opened its market, so the UI labels this honestly instead of calling it a true opener.

Line movement is calculated entirely from D1 data we already store. Viewing it costs no Odds API credits.

## Automatic updates

Spread refresh checks run hourly, but D1 is checked first and the paid Odds API is only called when the market data is due for a refresh.

Refresh target by time to the next kickoff:

- More than 72 hours away: every **24 hours**
- 24–72 hours away: every **12 hours**
- 6–24 hours away: every **6 hours**
- Within 6 hours: every **2 hours**

Once a game starts it is no longer refreshed. Every changed bookmaker line is preserved as a new snapshot instead of overwriting history.

Final-score checks remain separate. The system checks D1 first and only calls the paid score feed when a stored game should already have a final.

## Install as an app

The site includes a web app manifest, app icons, and a service worker so supported browsers can install it as a standalone PWA.

On iPhone, open the live URL in Safari and use **Share → Add to Home Screen**. The installed app opens without the normal browser chrome.

The service worker uses network-first navigation and never caches API responses. New releases replace the old versioned shell cache and reload when the new worker takes control.

## Version check

The bottom of **Tools** shows:

**NFL Spread Tool · App vX.X.X · API vX.X.X**

Normally the two versions should match. A mismatch means the phone has an older frontend loaded while the API has already deployed a newer version.

## Tools

- **Update Lines:** manually pull fresh sportsbook spreads
- **Check Final Scores:** guarded completed-game check
- **Results Integrity:** find missing or stale finals without API credits
- **API Usage:** view tracked requests and remaining quota

The in-app **?** button gives the same explanation in a shorter, mobile-friendly format.

## Data philosophy

The engine is **current-season only**. Historical workbook data is not required for the 2026 model. Week 1 begins neutral; projections become available as completed 2026 games create real current-season samples.
