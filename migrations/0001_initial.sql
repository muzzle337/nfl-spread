PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  week INTEGER NOT NULL,
  season_type TEXT NOT NULL DEFAULT 'REGULAR',
  away_team TEXT NOT NULL,
  home_team TEXT NOT NULL,
  kickoff_at TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  opening_away_spread REAL,
  current_away_spread REAL,
  closing_away_spread REAL,
  away_score INTEGER,
  home_score INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_games_season_week ON games(season, season_type, week);

CREATE TABLE IF NOT EXISTS line_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  away_spread REAL NOT NULL,
  source TEXT NOT NULL,
  away_classification TEXT,
  home_classification TEXT,
  tier TEXT,
  season_cover_rate REAL,
  grade TEXT,
  FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_line_game_time ON line_snapshots(game_id, captured_at);

CREATE TABLE IF NOT EXISTS api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  provider TEXT NOT NULL,
  request_type TEXT NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  credits_remaining INTEGER,
  trigger_type TEXT,
  success INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO settings(key, value) VALUES ('focus_min', '55');
INSERT OR IGNORE INTO settings(key, value) VALUES ('grade_a_min', '70');
INSERT OR IGNORE INTO settings(key, value) VALUES ('grade_b_min', '60');
