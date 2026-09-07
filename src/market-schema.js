export async function ensureMarketSchema(db) {
  if (!db) throw new Error("Database is not bound");

  const statements = [
    `CREATE TABLE IF NOT EXISTS moneyline_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      away_moneyline INTEGER NOT NULL,
      home_moneyline INTEGER NOT NULL,
      source TEXT NOT NULL,
      FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_moneyline_game_time ON moneyline_snapshots(game_id, captured_at)`,
    `CREATE TABLE IF NOT EXISTS survivor_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season INTEGER NOT NULL,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(season, name)
    )`,
    `CREATE TABLE IF NOT EXISTS survivor_picks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      season INTEGER NOT NULL,
      week INTEGER NOT NULL,
      team TEXT NOT NULL,
      game_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(entry_id, week),
      FOREIGN KEY(entry_id) REFERENCES survivor_entries(id) ON DELETE CASCADE,
      FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE SET NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_survivor_picks_entry_season ON survivor_picks(entry_id, season, week)`
  ];

  for (const statement of statements) {
    await db.prepare(statement).run();
  }
}
