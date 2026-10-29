import { createHash, randomUUID } from 'crypto'
import { readdir, stat } from 'fs/promises'
import { basename, dirname, extname, join, normalize, sep } from 'path'
import type { IAudioMetadata } from 'music-metadata'
import type { ScanProgress, ScanResult } from '../../../shared/types'
import { getDb } from '../../db/database'
import { saveArtwork } from './artwork'
import { isAudioFile } from './audioExtensions'
import { cleanupOrphans, findFolderByPath } from './queries'

type ProgressHandler = (progress: ScanProgress) => void

type ExistingTrack = {
  id: string
  path: string
  mtime_ms: number | null
  file_size: number | null
  content_hash: string | null
}

function normalizePath(p: string): string {
  return normalize(p).replace(/[/\\]+$/, '')
}

function isPathInsideFolder(filePath: string, folderPath: string): boolean {
  const folder = normalizePath(folderPath).toLowerCase() + sep
  const file = normalize(filePath).toLowerCase()
  return file === folder.slice(0, -1) || file.startsWith(folder)
}

async function walkAudioFiles(root: string): Promise<string[]> {
  const results: string[] = []

  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile() && isAudioFile(full)) {
        results.push(full)
      }
    }
  }

  await walk(root)
  return results
}

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) return item.trim()
    }
  }
  return null
}

function titleFromFilename(filePath: string): string {
  return basename(filePath, extname(filePath)).replace(/[_]+/g, ' ').trim() || 'Unknown Title'
}

function contentHash(size: number, mtimeMs: number): string {
  return createHash('sha1').update(`${size}:${mtimeMs}`).digest('hex')
}

function getOrCreateArtist(name: string): string {
  const db = getDb()
  const clean = name.trim() || 'Unknown Artist'
  const existing = db
    .prepare('SELECT id FROM artists WHERE name = ? COLLATE NOCASE')
    .get(clean) as { id: string } | undefined
  if (existing) return existing.id

  const id = randomUUID()
  db.prepare('INSERT INTO artists (id, name, name_sort) VALUES (?, ?, ?)').run(id, clean, clean)
  return id
}

function getOrCreateAlbum(title: string, artistId: string, year: number | null): string {
  const db = getDb()
  const clean = title.trim() || 'Unknown Album'
  const existing = db
    .prepare('SELECT id FROM albums WHERE title = ? COLLATE NOCASE AND artist_id = ?')
    .get(clean, artistId) as { id: string } | undefined
  if (existing) {
    if (year != null) {
      db.prepare('UPDATE albums SET year = COALESCE(year, ?) WHERE id = ?').run(year, existing.id)
    }
    return existing.id
  }

  const id = randomUUID()
  db.prepare('INSERT INTO albums (id, title, artist_id, year, artwork_path) VALUES (?, ?, ?, ?, NULL)').run(
    id,
    clean,
    artistId,
    year
  )
  return id
}

async function parseMetadata(filePath: string): Promise<IAudioMetadata | null> {
  try {
    const musicMetadata = await import('music-metadata')
    return await musicMetadata.parseFile(filePath, { duration: true })
  } catch {
    return null
  }
}

export async function addLibraryFolder(folderPath: string): Promise<{
  id: string
  created: boolean
}> {
  const db = getDb()
  const normalized = normalizePath(folderPath)
  const existing = findFolderByPath(normalized)
  if (existing) {
    return { id: existing.id, created: false }
  }

  const id = randomUUID()
  db.prepare('INSERT INTO library_folders (id, path, added_at, last_scanned_at) VALUES (?, ?, ?, NULL)').run(
    id,
    normalized,
    new Date().toISOString()
  )
  return { id, created: true }
}

export async function scanFolder(
  folderId: string,
  onProgress?: ProgressHandler
): Promise<ScanResult> {
  const db = getDb()
  const folder = db
    .prepare('SELECT id, path FROM library_folders WHERE id = ?')
    .get(folderId) as { id: string; path: string } | undefined

  if (!folder) {
    throw new Error('Library folder not found')
  }

  const errors: string[] = []
  const duplicates: Array<{ path: string; otherPath: string }> = []
  let added = 0
  let updated = 0
  let unchanged = 0
  let removed = 0

  const emit = (partial: Partial<ScanProgress> & Pick<ScanProgress, 'phase'>): void => {
    onProgress?.({
      phase: partial.phase,
      folderPath: folder.path,
      currentFile: partial.currentFile,
      processed: partial.processed ?? 0,
      total: partial.total ?? 0,
      added,
      updated,
      removed,
      errors: errors.length,
      message: partial.message
    })
  }

  emit({ phase: 'walking', processed: 0, total: 0, message: 'Walking folder…' })
  const files = await walkAudioFiles(folder.path)
  emit({ phase: 'parsing', processed: 0, total: files.length, message: `Found ${files.length} audio files` })

  const existingRows = db
    .prepare('SELECT id, path, mtime_ms, file_size, content_hash FROM tracks WHERE folder_id = ?')
    .all(folderId) as ExistingTrack[]
  const existingByPath = new Map(existingRows.map((row) => [row.path.toLowerCase(), row]))
  const seenPaths = new Set<string>()

  const upsert = db.prepare(`
    INSERT INTO tracks (
      id, path, folder_id, title, album_id, artist_id, album_artist,
      track_number, disc_number, year, genre, duration_ms, bitrate, sample_rate, codec,
      file_size, mtime_ms, content_hash, artwork_path, missing, date_added, date_modified
    ) VALUES (
      @id, @path, @folder_id, @title, @album_id, @artist_id, @album_artist,
      @track_number, @disc_number, @year, @genre, @duration_ms, @bitrate, @sample_rate, @codec,
      @file_size, @mtime_ms, @content_hash, @artwork_path, 0, @date_added, @date_modified
    )
    ON CONFLICT(path) DO UPDATE SET
      folder_id = excluded.folder_id,
      title = excluded.title,
      album_id = excluded.album_id,
      artist_id = excluded.artist_id,
      album_artist = excluded.album_artist,
      track_number = excluded.track_number,
      disc_number = excluded.disc_number,
      year = excluded.year,
      genre = excluded.genre,
      duration_ms = excluded.duration_ms,
      bitrate = excluded.bitrate,
      sample_rate = excluded.sample_rate,
      codec = excluded.codec,
      file_size = excluded.file_size,
      mtime_ms = excluded.mtime_ms,
      content_hash = excluded.content_hash,
      artwork_path = COALESCE(excluded.artwork_path, tracks.artwork_path),
      missing = 0,
      date_modified = excluded.date_modified
  `)

  const findByHash = db.prepare(
    'SELECT path FROM tracks WHERE content_hash = ? AND path != ? LIMIT 1'
  )

  for (let index = 0; index < files.length; index++) {
    const filePath = files[index]
    seenPaths.add(filePath.toLowerCase())

    try {
      const info = await stat(filePath)
      const mtimeMs = Math.floor(info.mtimeMs)
      const fileSize = info.size
      const hash = contentHash(fileSize, mtimeMs)
      const previous = existingByPath.get(filePath.toLowerCase())

      if (
        previous &&
        previous.mtime_ms === mtimeMs &&
        previous.file_size === fileSize &&
        previous.content_hash === hash
      ) {
        unchanged += 1
        emit({
          phase: 'parsing',
          processed: index + 1,
          total: files.length,
          currentFile: filePath
        })
        continue
      }

      const metadata = await parseMetadata(filePath)
      const common = metadata?.common
      const format = metadata?.format

      const artistName =
        firstString(common?.artist) ||
        firstString(common?.albumartist) ||
        'Unknown Artist'
      const albumArtist = firstString(common?.albumartist)
      const albumTitle = firstString(common?.album) || 'Unknown Album'
      const title = firstString(common?.title) || titleFromFilename(filePath)
      const year = common?.year ?? null
      const genre = firstString(common?.genre)
      const trackNumber = common?.track?.no ?? null
      const discNumber = common?.disk?.no ?? null
      const durationMs =
        format?.duration != null && Number.isFinite(format.duration)
          ? Math.round(format.duration * 1000)
          : null
      const bitrate = format?.bitrate != null ? Math.round(format.bitrate) : null
      const sampleRate = format?.sampleRate ?? null
      const codec = format?.codec || extname(filePath).replace('.', '').toUpperCase() || null

      const artistId = getOrCreateArtist(artistName)
      const albumArtistId = getOrCreateArtist(albumArtist || artistName)
      const albumId = getOrCreateAlbum(albumTitle, albumArtistId, year)

      let artworkPath: string | null = null
      const picture = common?.picture?.[0]
      if (picture?.data) {
        try {
          artworkPath = saveArtwork(Buffer.from(picture.data), picture.format)
          db.prepare(
            'UPDATE albums SET artwork_path = COALESCE(artwork_path, ?) WHERE id = ?'
          ).run(artworkPath, albumId)
        } catch (error) {
          errors.push(`Artwork failed for ${filePath}: ${String(error)}`)
        }
      }

      const now = new Date().toISOString()
      const trackId = previous?.id ?? randomUUID()

      upsert.run({
        id: trackId,
        path: filePath,
        folder_id: folderId,
        title,
        album_id: albumId,
        artist_id: artistId,
        album_artist: albumArtist,
        track_number: trackNumber,
        disc_number: discNumber,
        year,
        genre,
        duration_ms: durationMs,
        bitrate,
        sample_rate: sampleRate,
        codec,
        file_size: fileSize,
        mtime_ms: mtimeMs,
        content_hash: hash,
        artwork_path: artworkPath,
        date_added: now,
        date_modified: now
      })

      // ON CONFLICT does not touch date_added, so first-seen dates stay stable.
      if (previous) updated += 1
      else added += 1

      const dup = findByHash.get(hash, filePath) as { path: string } | undefined
      if (dup) {
        duplicates.push({ path: filePath, otherPath: dup.path })
      }
    } catch (error) {
      errors.push(`${filePath}: ${String(error)}`)
    }

    if (index % 3 === 0 || index === files.length - 1) {
      emit({
        phase: 'parsing',
        processed: index + 1,
        total: files.length,
        currentFile: filePath
      })
    }
  }

  emit({ phase: 'finalizing', processed: files.length, total: files.length, message: 'Finalizing…' })

  for (const row of existingRows) {
    if (!seenPaths.has(row.path.toLowerCase())) {
      if (!isPathInsideFolder(row.path, folder.path)) continue
      db.prepare('UPDATE tracks SET missing = 1, date_modified = ? WHERE id = ?').run(
        new Date().toISOString(),
        row.id
      )
      removed += 1
    }
  }

  db.prepare('UPDATE library_folders SET last_scanned_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    folderId
  )
  cleanupOrphans()

  emit({
    phase: 'done',
    processed: files.length,
    total: files.length,
    message: `Scan complete — ${added} added, ${updated} updated, ${removed} missing`
  })

  return {
    folderId,
    folderPath: folder.path,
    added,
    updated,
    removed,
    unchanged,
    errors: errors.slice(0, 50),
    duplicates: duplicates.slice(0, 50)
  }
}

export async function scanAllFolders(onProgress?: ProgressHandler): Promise<ScanResult[]> {
  const db = getDb()
  const folders = db.prepare('SELECT id FROM library_folders').all() as Array<{ id: string }>
  const results: ScanResult[] = []
  for (const folder of folders) {
    results.push(await scanFolder(folder.id, onProgress))
  }
  return results
}

export async function importAudioFiles(filePaths: string[]): Promise<ScanResult | null> {
  if (filePaths.length === 0) return null

  const parents = [...new Set(filePaths.map((p) => dirname(p)))]
  // Prefer the common parent when possible; otherwise add each parent folder.
  const folderPath = parents.length === 1 ? parents[0] : dirname(filePaths[0])
  const { id } = await addLibraryFolder(folderPath)
  return scanFolder(id)
}
