export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 6,
    sql: `
      ALTER TABLE tracks ADD COLUMN user_meta_locked INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS track_lyrics_overrides (
        track_id TEXT PRIMARY KEY,
        raw_text TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );
    `
  }
]
