import { mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { MIGRATIONS } from './migrations'

let db: Database.Database | null = null

export function getUserDataPaths(): {
  root: string
  dbPath: string
  artworkDir: string
} {
  const root = app.getPath('userData')
  return {
    root,
    dbPath: join(root, 'umbrix-groove.sqlite'),
    artworkDir: join(root, 'artwork')
  }
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database has not been initialized')
  }
  return db
}

export function initDatabase(): Database.Database {
  if (db) return db

  const { dbPath, artworkDir } = getUserDataPaths()
  mkdirSync(artworkDir, { recursive: true })

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  migrate(db)
  return db
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const applied = new Set(
    database
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row) => (row as { version: number }).version)
  )

  const apply = database.transaction(() => {
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue
      database.exec(migration.sql)
      database
        .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(migration.version, new Date().toISOString())
    }
  })

  apply()
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
