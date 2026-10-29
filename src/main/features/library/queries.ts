import type {
  AlbumRow,
  ArtistRow,
  LibraryFolder,
  LibrarySummary,
  TrackQuery,
  TrackQueryResult,
  TrackRow,
  TrackSort
} from '../../../shared/types'
import { getDb } from '../../db/database'
import { artworkKeyFromPath } from './artwork'

type TrackJoinRow = {
  id: string
  path: string
  title: string
  artist_name: string | null
  album_title: string | null
  album_id: string | null
  artist_id: string | null
  track_number: number | null
  disc_number: number | null
  year: number | null
  genre: string | null
  duration_ms: number | null
  bitrate: number | null
  codec: string | null
  artwork_path: string | null
  missing: number
  date_added: string
}

export function mapTrack(row: TrackJoinRow): TrackRow {
  const title = row.title?.trim() || 'Unknown Title'
  const artistName = row.artist_name?.trim() || 'Unknown Artist'
  const albumTitle = row.album_title?.trim() || 'Unknown Album'
  const incompleteMetadata =
    !row.title?.trim() ||
    !row.artist_name?.trim() ||
    !row.album_title?.trim() ||
    row.duration_ms == null

  return {
    id: row.id,
    path: row.path,
    title,
    artistName,
    albumTitle,
    albumId: row.album_id,
    artistId: row.artist_id,
    trackNumber: row.track_number,
    discNumber: row.disc_number,
    year: row.year,
    genre: row.genre,
    durationMs: row.duration_ms,
    bitrate: row.bitrate,
    codec: row.codec,
    artworkKey: artworkKeyFromPath(row.artwork_path),
    missing: row.missing === 1,
    dateAdded: row.date_added,
    incompleteMetadata
  }
}

const SORT_COLUMNS: Record<TrackSort, string> = {
  title: 't.title COLLATE NOCASE',
  artist: 'artist_name COLLATE NOCASE',
  album: 'album_title COLLATE NOCASE',
  duration: 't.duration_ms',
  date_added: 't.date_added',
  track_number: 't.disc_number, t.track_number, t.title COLLATE NOCASE'
}

export function getSummary(): LibrarySummary {
  const db = getDb()
  const trackCount = (
    db.prepare('SELECT COUNT(*) AS c FROM tracks WHERE missing = 0').get() as { c: number }
  ).c
  const albumCount = (db.prepare('SELECT COUNT(*) AS c FROM albums').get() as { c: number }).c
  const artistCount = (db.prepare('SELECT COUNT(*) AS c FROM artists').get() as { c: number }).c
  const folderCount = (
    db.prepare('SELECT COUNT(*) AS c FROM library_folders').get() as { c: number }
  ).c
  const missingCount = (
    db.prepare('SELECT COUNT(*) AS c FROM tracks WHERE missing = 1').get() as { c: number }
  ).c
  const incompleteCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM tracks t
         LEFT JOIN artists ar ON ar.id = t.artist_id
         LEFT JOIN albums al ON al.id = t.album_id
         WHERE t.missing = 0 AND (
           TRIM(t.title) = '' OR t.title IS NULL
           OR ar.name IS NULL OR TRIM(ar.name) = ''
           OR al.title IS NULL OR TRIM(al.title) = ''
           OR t.duration_ms IS NULL
         )`
      )
      .get() as { c: number }
  ).c

  return {
    trackCount,
    albumCount,
    artistCount,
    folderCount,
    missingCount,
    incompleteCount
  }
}

export function listFolders(): LibraryFolder[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT f.id, f.path, f.added_at, f.last_scanned_at,
              (SELECT COUNT(*) FROM tracks t WHERE t.folder_id = f.id AND t.missing = 0) AS track_count
       FROM library_folders f
       ORDER BY f.path COLLATE NOCASE`
    )
    .all() as Array<{
    id: string
    path: string
    added_at: string
    last_scanned_at: string | null
    track_count: number
  }>

  return rows.map((row) => ({
    id: row.id,
    path: row.path,
    addedAt: row.added_at,
    lastScannedAt: row.last_scanned_at,
    trackCount: row.track_count
  }))
}

export function queryTracks(options: TrackQuery = {}): TrackQueryResult {
  const db = getDb()
  const sort = options.sort ?? 'title'
  const ascending = options.ascending ?? true
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 2000)
  const offset = Math.max(options.offset ?? 0, 0)
  const direction = ascending ? 'ASC' : 'DESC'
  const orderBy = SORT_COLUMNS[sort] ?? SORT_COLUMNS.title

  const where: string[] = []
  const params: unknown[] = []

  if (options.missingOnly) {
    where.push('t.missing = 1')
  } else {
    where.push('t.missing = 0')
  }

  if (options.albumId) {
    where.push('t.album_id = ?')
    params.push(options.albumId)
  }

  if (options.artistId) {
    where.push('t.artist_id = ?')
    params.push(options.artistId)
  }

  if (options.genre) {
    where.push('t.genre = ? COLLATE NOCASE')
    params.push(options.genre)
  }

  if (options.query?.trim()) {
    const q = `%${options.query.trim()}%`
    where.push(
      `(t.title LIKE ? COLLATE NOCASE
        OR COALESCE(ar.name, '') LIKE ? COLLATE NOCASE
        OR COALESCE(al.title, '') LIKE ? COLLATE NOCASE
        OR COALESCE(t.genre, '') LIKE ? COLLATE NOCASE)`
    )
    params.push(q, q, q, q)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS c
         FROM tracks t
         LEFT JOIN artists ar ON ar.id = t.artist_id
         LEFT JOIN albums al ON al.id = t.album_id
         ${whereSql}`
      )
      .get(...params) as { c: number }
  ).c

  const rows = db
    .prepare(
      `SELECT t.id, t.path, t.title,
              ar.name AS artist_name,
              al.title AS album_title,
              t.album_id, t.artist_id, t.track_number, t.disc_number, t.year, t.genre,
              t.duration_ms, t.bitrate, t.codec, t.artwork_path, t.missing, t.date_added
       FROM tracks t
       LEFT JOIN artists ar ON ar.id = t.artist_id
       LEFT JOIN albums al ON al.id = t.album_id
       ${whereSql}
       ORDER BY ${orderBy} ${direction}
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as TrackJoinRow[]

  return {
    tracks: rows.map(mapTrack),
    total
  }
}

export function listAlbums(query?: string): AlbumRow[] {
  const db = getDb()
  const params: unknown[] = []
  let where = ''

  if (query?.trim()) {
    where = `WHERE al.title LIKE ? COLLATE NOCASE OR COALESCE(ar.name, '') LIKE ? COLLATE NOCASE`
    const q = `%${query.trim()}%`
    params.push(q, q)
  }

  const rows = db
    .prepare(
      `SELECT al.id, al.title, COALESCE(ar.name, 'Unknown Artist') AS artist_name, al.year,
              al.artwork_path,
              (SELECT COUNT(*) FROM tracks t WHERE t.album_id = al.id AND t.missing = 0) AS track_count
       FROM albums al
       LEFT JOIN artists ar ON ar.id = al.artist_id
       ${where}
       ORDER BY al.title COLLATE NOCASE
       LIMIT 500`
    )
    .all(...params) as Array<{
    id: string
    title: string
    artist_name: string
    year: number | null
    artwork_path: string | null
    track_count: number
  }>

  return rows
    .filter((row) => row.track_count > 0)
    .map((row) => ({
      id: row.id,
      title: row.title,
      artistName: row.artist_name,
      year: row.year,
      trackCount: row.track_count,
      artworkKey: artworkKeyFromPath(row.artwork_path)
    }))
}

export function listArtists(query?: string): ArtistRow[] {
  const db = getDb()
  const params: unknown[] = []
  let where = ''

  if (query?.trim()) {
    where = `WHERE ar.name LIKE ? COLLATE NOCASE`
    params.push(`%${query.trim()}%`)
  }

  const rows = db
    .prepare(
      `SELECT ar.id, ar.name,
              (SELECT COUNT(*) FROM tracks t WHERE t.artist_id = ar.id AND t.missing = 0) AS track_count,
              (SELECT COUNT(DISTINCT t.album_id) FROM tracks t WHERE t.artist_id = ar.id AND t.missing = 0 AND t.album_id IS NOT NULL) AS album_count
       FROM artists ar
       ${where}
       ORDER BY ar.name COLLATE NOCASE
       LIMIT 500`
    )
    .all(...params) as Array<{
    id: string
    name: string
    track_count: number
    album_count: number
  }>

  return rows
    .filter((row) => row.track_count > 0)
    .map((row) => ({
      id: row.id,
      name: row.name,
      trackCount: row.track_count,
      albumCount: row.album_count
    }))
}

export function listGenres(): Array<{ genre: string; trackCount: number }> {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT genre, COUNT(*) AS track_count
       FROM tracks
       WHERE missing = 0 AND genre IS NOT NULL AND TRIM(genre) != ''
       GROUP BY genre COLLATE NOCASE
       ORDER BY genre COLLATE NOCASE
       LIMIT 300`
    )
    .all() as Array<{ genre: string; track_count: number }>

  return rows.map((row) => ({ genre: row.genre, trackCount: row.track_count }))
}

export function getRecentTracks(limit = 24): TrackRow[] {
  return queryTracks({ sort: 'date_added', ascending: false, limit }).tracks
}

/** Resolve a track's on-disk path for the media protocol. */
export function getTrackMediaById(
  trackId: string
): { path: string; codec: string | null } | null {
  const db = getDb()
  const row = db
    .prepare('SELECT path, codec, missing FROM tracks WHERE id = ?')
    .get(trackId) as { path: string; codec: string | null; missing: number } | undefined

  if (!row || row.missing === 1) return null
  return { path: row.path, codec: row.codec }
}

export function removeFolder(folderId: string): boolean {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM library_folders WHERE id = ?').get(folderId)
  if (!existing) return false

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM tracks WHERE folder_id = ?').run(folderId)
    db.prepare('DELETE FROM library_folders WHERE id = ?').run(folderId)
    cleanupOrphans()
  })
  tx()
  return true
}

export function cleanupOrphans(): void {
  const db = getDb()
  db.prepare(
    `DELETE FROM albums
     WHERE id NOT IN (SELECT DISTINCT album_id FROM tracks WHERE album_id IS NOT NULL)`
  ).run()
  db.prepare(
    `DELETE FROM artists
     WHERE id NOT IN (SELECT DISTINCT artist_id FROM tracks WHERE artist_id IS NOT NULL)
       AND id NOT IN (SELECT DISTINCT artist_id FROM albums WHERE artist_id IS NOT NULL)`
  ).run()
}

export function findFolderByPath(folderPath: string): LibraryFolder | null {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT f.id, f.path, f.added_at, f.last_scanned_at,
              (SELECT COUNT(*) FROM tracks t WHERE t.folder_id = f.id AND t.missing = 0) AS track_count
       FROM library_folders f
       WHERE f.path = ? COLLATE NOCASE`
    )
    .get(folderPath) as
    | {
        id: string
        path: string
        added_at: string
        last_scanned_at: string | null
        track_count: number
      }
    | undefined

  if (!row) return null
  return {
    id: row.id,
    path: row.path,
    addedAt: row.added_at,
    lastScannedAt: row.last_scanned_at,
    trackCount: row.track_count
  }
}

/** Return tracks for the given ids, preserving input order. */
export function listTracksByIds(ids: string[]): TrackRow[] {
  if (ids.length === 0) return []
  const db = getDb()
  const placeholders = ids.map(() => '?').join(', ')
  const rows = db
    .prepare(
      `SELECT t.id, t.path, t.title,
              ar.name AS artist_name,
              al.title AS album_title,
              t.album_id, t.artist_id, t.track_number, t.disc_number, t.year, t.genre,
              t.duration_ms, t.bitrate, t.codec, t.artwork_path, t.missing, t.date_added
       FROM tracks t
       LEFT JOIN artists ar ON ar.id = t.artist_id
       LEFT JOIN albums al ON al.id = t.album_id
       WHERE t.id IN (${placeholders})`
    )
    .all(...ids) as TrackJoinRow[]

  const byId = new Map(rows.map((row) => [row.id, mapTrack(row)]))
  return ids.map((id) => byId.get(id)).filter((track): track is TrackRow => Boolean(track))
}
