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
    `CREATE INDEX IF NOT EXISTS idx_moneyline_game_time ON moneyline_snapshots(game_id, captured_at)`
  ];

  for (const statement of statements) {
    await db.prepare(statement).run();
  }
}
