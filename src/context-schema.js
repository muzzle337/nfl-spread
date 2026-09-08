export async function ensureContextSchema(db) {
  if (!db) throw new Error("Database is not bound");
  const statements = [
    `CREATE TABLE IF NOT EXISTS context_games (
      game_id TEXT PRIMARY KEY,
      season INTEGER NOT NULL,
      week INTEGER NOT NULL,
      stadium TEXT,
      location TEXT,
      roof TEXT,
      surface TEXT,
      away_rest INTEGER,
      home_rest INTEGER,
      away_coach TEXT,
      home_coach TEXT,
      away_qb TEXT,
      home_qb TEXT,
      nflverse_game_id TEXT,
      nfldata_game_id TEXT,
      synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_context_games_week ON context_games(season, week)`,
    `CREATE TABLE IF NOT EXISTS context_team_metrics (
      season INTEGER NOT NULL,
      week INTEGER NOT NULL,
      team TEXT NOT NULL,
      wins INTEGER,
      losses INTEGER,
      ties INTEGER,
      points_for REAL,
      points_against REAL,
      point_diff REAL,
      offensive_epa REAL,
      defensive_epa REAL,
      success_rate REAL,
      source TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(season, week, team, source)
    )`,
    `CREATE TABLE IF NOT EXISTS context_weather (
      game_id TEXT PRIMARY KEY,
      forecast_for TEXT,
      temperature_f REAL,
      apparent_temperature_f REAL,
      precipitation_probability REAL,
      precipitation_in REAL,
      snowfall_in REAL,
      wind_mph REAL,
      gust_mph REAL,
      weather_code INTEGER,
      source TEXT NOT NULL DEFAULT 'open-meteo',
      fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS context_sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season INTEGER NOT NULL,
      week INTEGER NOT NULL,
      nfldata_ok INTEGER NOT NULL DEFAULT 0,
      nflverse_ok INTEGER NOT NULL DEFAULT 0,
      weather_ok INTEGER NOT NULL DEFAULT 0,
      games_updated INTEGER NOT NULL DEFAULT 0,
      weather_updated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ];
  for (const statement of statements) await db.prepare(statement).run();
}
