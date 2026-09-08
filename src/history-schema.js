export async function ensureHistorySchema(db) {
  if (!db) throw new Error("Database is not bound");
  const statements = [
    `CREATE TABLE IF NOT EXISTS historical_games (
      game_id TEXT PRIMARY KEY,
      season INTEGER NOT NULL,
      week INTEGER NOT NULL,
      game_type TEXT NOT NULL,
      gameday TEXT,
      weekday TEXT,
      gametime TEXT,
      away_team TEXT NOT NULL,
      home_team TEXT NOT NULL,
      away_score INTEGER,
      home_score INTEGER,
      result REAL,
      spread_line REAL,
      total_line REAL,
      location TEXT,
      stadium TEXT,
      roof TEXT,
      surface TEXT,
      temp_f REAL,
      wind_mph REAL,
      away_rest INTEGER,
      home_rest INTEGER,
      away_coach TEXT,
      home_coach TEXT,
      div_game INTEGER,
      prime_time INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'nflverse',
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_history_season_week ON historical_games(season, week)`,
    `CREATE INDEX IF NOT EXISTS idx_history_away_coach ON historical_games(away_coach)`,
    `CREATE INDEX IF NOT EXISTS idx_history_home_coach ON historical_games(home_coach)`,
    `CREATE INDEX IF NOT EXISTS idx_history_prime_time ON historical_games(prime_time)`,
    `CREATE TABLE IF NOT EXISTS historical_import_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_season INTEGER NOT NULL,
      end_season INTEGER NOT NULL,
      games_imported INTEGER NOT NULL,
      source_rows INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'nflverse',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ];
  for (const sql of statements) await db.prepare(sql).run();
}
