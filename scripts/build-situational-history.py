#!/usr/bin/env python3
"""Build the compact Phase 3 situation snapshot from nflverse PBP CSV files."""

import csv
import gzip
import json
import sys
from collections import defaultdict
from pathlib import Path


ALIASES = {"LA": "LAR", "JAC": "JAX", "OAK": "LV", "SD": "LAC", "STL": "LAR"}
CONDITIONS = (
    "trailingHalftime",
    "leadingHalftime",
    "trailingEnteringQ4",
    "leadingEnteringQ4",
    "closeEnteringQ4",
    "oneScoreGame",
    "trailedBy7Plus",
)


def code(value):
    value = str(value or "").strip().upper()
    return ALIASES.get(value, value)


def number(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def record_summary(outcomes):
    wins = outcomes.count("W")
    losses = outcomes.count("L")
    ties = outcomes.count("T")
    decisions = wins + losses
    return {
        "games": len(outcomes),
        "wins": wins,
        "losses": losses,
        "ties": ties,
        "winPct": round(wins / decisions * 100, 1) if decisions else None,
    }


def add_event(target, subject, condition, outcome):
    target[subject][condition].append(outcome)


def main(paths):
    games = {}
    seasons = []
    for path_text in paths:
        path = Path(path_text)
        with gzip.open(path, "rt", newline="", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                if str(row.get("season_type", "REG")).upper() != "REG":
                    continue
                season = number(row.get("season"))
                game_id = row.get("game_id")
                if not game_id or season is None:
                    continue
                seasons.append(season)
                state = games.setdefault(game_id, {
                    "season": season,
                    "home": code(row.get("home_team")),
                    "away": code(row.get("away_team")),
                    "half": None,
                    "q3": None,
                    "final": None,
                    "maxHomeDeficit": 0,
                    "maxAwayDeficit": 0,
                })
                home_score = number(row.get("total_home_score"))
                away_score = number(row.get("total_away_score"))
                quarter = number(row.get("qtr"))
                if home_score is None or away_score is None:
                    continue
                state["final"] = [home_score, away_score]
                if quarter is not None and quarter <= 2:
                    state["half"] = [home_score, away_score]
                if quarter is not None and quarter <= 3:
                    state["q3"] = [home_score, away_score]
                state["maxHomeDeficit"] = max(state["maxHomeDeficit"], away_score - home_score)
                state["maxAwayDeficit"] = max(state["maxAwayDeficit"], home_score - away_score)

    team_events = defaultdict(lambda: defaultdict(list))
    league_events = defaultdict(list)
    valid_games = 0
    for state in games.values():
        if not state["home"] or not state["away"] or not state["half"] or not state["q3"] or not state["final"]:
            continue
        valid_games += 1
        final_home, final_away = state["final"]
        half_home, half_away = state["half"]
        q3_home, q3_away = state["q3"]
        for side in ("home", "away"):
            team = state[side]
            is_home = side == "home"
            own_final, opp_final = (final_home, final_away) if is_home else (final_away, final_home)
            own_half, opp_half = (half_home, half_away) if is_home else (half_away, half_home)
            own_q3, opp_q3 = (q3_home, q3_away) if is_home else (q3_away, q3_home)
            outcome = "W" if own_final > opp_final else "L" if own_final < opp_final else "T"
            matched = []
            if own_half < opp_half:
                matched.append("trailingHalftime")
            elif own_half > opp_half:
                matched.append("leadingHalftime")
            if own_q3 < opp_q3:
                matched.append("trailingEnteringQ4")
            elif own_q3 > opp_q3:
                matched.append("leadingEnteringQ4")
            if abs(own_q3 - opp_q3) <= 7:
                matched.append("closeEnteringQ4")
            if abs(own_final - opp_final) <= 8:
                matched.append("oneScoreGame")
            max_deficit = state["maxHomeDeficit"] if is_home else state["maxAwayDeficit"]
            if max_deficit >= 7:
                matched.append("trailedBy7Plus")
            for condition in matched:
                add_event(team_events, team, condition, outcome)
                league_events[condition].append(outcome)

    teams = {
        team: {condition: record_summary(outcomes) for condition, outcomes in values.items()}
        for team, values in sorted(team_events.items())
    }
    league = {condition: record_summary(league_events[condition]) for condition in CONDITIONS}
    start = min(seasons) if seasons else None
    end = max(seasons) if seasons else None
    payload = {
        "schemaVersion": 1,
        "source": "nflverse play-by-play",
        "timeframe": {"fromSeason": start, "toSeason": end},
        "games": valid_games,
        "definitions": {
            "trailingHalftime": "Team trailed after the final play of the second quarter.",
            "leadingHalftime": "Team led after the final play of the second quarter.",
            "trailingEnteringQ4": "Team trailed after the final play of the third quarter.",
            "leadingEnteringQ4": "Team led after the final play of the third quarter.",
            "closeEnteringQ4": "Score margin was seven points or fewer after the third quarter.",
            "oneScoreGame": "Final score margin was eight points or fewer.",
            "trailedBy7Plus": "Team trailed by at least seven points at any recorded play.",
        },
        "league": league,
        "teams": teams,
    }
    json.dump(payload, sys.stdout, separators=(",", ":"), sort_keys=True)
    sys.stdout.write("\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("usage: build-situational-history.py YEAR.csv.gz [...]")
    main(sys.argv[1:])
