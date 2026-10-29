export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS playlist_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES playlist_folders(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        folder_id TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        is_system INTEGER NOT NULL DEFAULT 0,
        system_key TEXT UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (folder_id) REFERENCES playlist_folders(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        added_at TEXT NOT NULL,
        PRIMARY KEY (playlist_id, track_id),
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, position);
      CREATE INDEX IF NOT EXISTS idx_playlist_folders_parent ON playlist_folders(parent_id, position);
      CREATE INDEX IF NOT EXISTS idx_playlists_folder ON playlists(folder_id, position);

      CREATE TABLE IF NOT EXISTS track_ratings (
        track_id TEXT PRIMARY KEY,
        rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 5),
        updated_at TEXT NOT NULL,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS track_tags (
        track_id TEXT NOT NULL,
        tag TEXT NOT NULL COLLATE NOCASE,
        PRIMARY KEY (track_id, tag),
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_track_tags_tag ON track_tags(tag);
    `
  }
]
