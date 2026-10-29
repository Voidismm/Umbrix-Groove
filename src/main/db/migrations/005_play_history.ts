export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 5,
    sql: `
      ALTER TABLE tracks ADD COLUMN play_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE tracks ADD COLUMN last_played_at TEXT;

      CREATE TABLE IF NOT EXISTS play_events (
        id TEXT PRIMARY KEY,
        track_id TEXT NOT NULL,
        played_at TEXT NOT NULL,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_play_events_track ON play_events(track_id);
      CREATE INDEX IF NOT EXISTS idx_play_events_played_at ON play_events(played_at);

      CREATE TABLE IF NOT EXISTS daily_mixes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        subtitle TEXT,
        decade_label TEXT NOT NULL,
        genre_key TEXT NOT NULL,
        accent_color TEXT,
        generated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_mix_tracks (
        mix_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (mix_id, track_id),
        FOREIGN KEY (mix_id) REFERENCES daily_mixes(id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_daily_mix_tracks_mix ON daily_mix_tracks(mix_id, position);
    `
  }
]
