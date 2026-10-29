export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 4,
    sql: `
      ALTER TABLE playlists ADD COLUMN accent_color TEXT;
    `
  }
]
