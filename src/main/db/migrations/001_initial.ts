export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS library_folders (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        added_at TEXT NOT NULL,
        last_scanned_at TEXT
      );

      CREATE TABLE IF NOT EXISTS artists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL COLLATE NOCASE,
        name_sort TEXT,
        UNIQUE (name COLLATE NOCASE)
      );

      CREATE TABLE IF NOT EXISTS albums (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL COLLATE NOCASE,
        artist_id TEXT,
        year INTEGER,
        artwork_path TEXT,
        UNIQUE (title COLLATE NOCASE, artist_id),
        FOREIGN KEY (artist_id) REFERENCES artists(id)
      );

      CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        folder_id TEXT NOT NULL,
        title TEXT NOT NULL,
        album_id TEXT,
        artist_id TEXT,
        album_artist TEXT,
        track_number INTEGER,
        disc_number INTEGER,
        year INTEGER,
        genre TEXT,
        duration_ms INTEGER,
        bitrate INTEGER,
        sample_rate INTEGER,
        codec TEXT,
        file_size INTEGER,
        mtime_ms INTEGER,
        content_hash TEXT,
        artwork_path TEXT,
        missing INTEGER NOT NULL DEFAULT 0,
        date_added TEXT NOT NULL,
        date_modified TEXT,
        FOREIGN KEY (folder_id) REFERENCES library_folders(id) ON DELETE CASCADE,
        FOREIGN KEY (album_id) REFERENCES albums(id),
        FOREIGN KEY (artist_id) REFERENCES artists(id)
      );

      CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
      CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);
      CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);
      CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
      CREATE INDEX IF NOT EXISTS idx_tracks_missing ON tracks(missing);
      CREATE INDEX IF NOT EXISTS idx_tracks_content_hash ON tracks(content_hash);
      CREATE INDEX IF NOT EXISTS idx_tracks_date_added ON tracks(date_added);
    `
  }
]
