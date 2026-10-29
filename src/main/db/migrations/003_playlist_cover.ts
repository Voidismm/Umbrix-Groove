export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 3,
    sql: `
      ALTER TABLE playlists ADD COLUMN cover_key TEXT;
    `
  }
]
