import { randomUUID } from 'crypto'
import type { TrackMetadataPatch, TrackRow } from '../../../shared/types'
import { getDb } from '../../db/database'
import { saveArtwork } from './artwork'
import { listTracksByIds } from './queries'

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
  db.prepare(
    'INSERT INTO albums (id, title, artist_id, year, artwork_path) VALUES (?, ?, ?, ?, NULL)'
  ).run(id, clean, artistId, year)
  return id
}

function parseOptionalInt(value: number | null | undefined): number | null {
  if (value == null) return null
  if (!Number.isFinite(value)) return null
  const n = Math.trunc(value)
  return n > 0 ? n : null
}

export function getTrackLyricsOverride(trackId: string): string | null {
  if (!trackId) return null
  const db = getDb()
  const row = db
    .prepare('SELECT raw_text FROM track_lyrics_overrides WHERE track_id = ?')
    .get(trackId) as { raw_text: string } | undefined
  return row?.raw_text ?? null
}

function artworkBufferFromPatch(
  data: ArrayBuffer | Uint8Array | Buffer | unknown
): Buffer | null {
  if (data == null) return null
  if (Buffer.isBuffer(data)) return data
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  }
  return null
}

/** Update how a track looks in Groove. Does not rewrite the audio file. */
export function updateTrackMetadata(trackId: string, patch: TrackMetadataPatch): TrackRow {
  if (!trackId) throw new Error('Invalid track id')

  const db = getDb()
  const existing = db
    .prepare('SELECT id, artwork_path FROM tracks WHERE id = ?')
    .get(trackId) as { id: string; artwork_path: string | null } | undefined
  if (!existing) throw new Error('Track not found')

  const title =
    (typeof patch.title === 'string' ? patch.title : '').trim() || 'Unknown Title'
  const artistName =
    (typeof patch.artistName === 'string' ? patch.artistName : '').trim() || 'Unknown Artist'
  const albumTitle =
    (typeof patch.albumTitle === 'string' ? patch.albumTitle : '').trim() || 'Unknown Album'
  const trackNumber = parseOptionalInt(patch.trackNumber)
  const discNumber = parseOptionalInt(patch.discNumber)
  const year =
    patch.year != null && Number.isFinite(patch.year) ? Math.trunc(patch.year) : null
  const genre = (typeof patch.genre === 'string' ? patch.genre.trim() : '') || null

  const artistId = getOrCreateArtist(artistName)
  const albumId = getOrCreateAlbum(albumTitle, artistId, year)

  let artworkPath: string | null | undefined = undefined
  if (patch.artwork === null) {
    artworkPath = null
  } else if (patch.artwork && patch.artwork.data != null) {
    const buf = artworkBufferFromPatch(patch.artwork.data)
    if (!buf || buf.length === 0) {
      throw new Error('Cover art could not be read. Try another image.')
    }
    artworkPath = saveArtwork(buf, patch.artwork.mime)
    db.prepare(
      'UPDATE albums SET artwork_path = COALESCE(artwork_path, ?) WHERE id = ?'
    ).run(artworkPath, albumId)
  }

  const now = new Date().toISOString()

  if (artworkPath === undefined) {
    db.prepare(
      `UPDATE tracks SET
        title = ?,
        artist_id = ?,
        album_id = ?,
        album_artist = ?,
        track_number = ?,
        disc_number = ?,
        year = ?,
        genre = ?,
        user_meta_locked = 1,
        date_modified = ?
      WHERE id = ?`
    ).run(
      title,
      artistId,
      albumId,
      artistName,
      trackNumber,
      discNumber,
      year,
      genre,
      now,
      trackId
    )
  } else {
    db.prepare(
      `UPDATE tracks SET
        title = ?,
        artist_id = ?,
        album_id = ?,
        album_artist = ?,
        track_number = ?,
        disc_number = ?,
        year = ?,
        genre = ?,
        artwork_path = ?,
        user_meta_locked = 1,
        date_modified = ?
      WHERE id = ?`
    ).run(
      title,
      artistId,
      albumId,
      artistName,
      trackNumber,
      discNumber,
      year,
      genre,
      artworkPath,
      now,
      trackId
    )
  }

  if (patch.lyricsText !== undefined) {
    const text = typeof patch.lyricsText === 'string' ? patch.lyricsText.trim() : ''
    if (!text) {
      db.prepare('DELETE FROM track_lyrics_overrides WHERE track_id = ?').run(trackId)
    } else {
      db.prepare(
        `INSERT INTO track_lyrics_overrides (track_id, raw_text, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(track_id) DO UPDATE SET
           raw_text = excluded.raw_text,
           updated_at = excluded.updated_at`
      ).run(trackId, text, now)
    }
  }

  const [track] = listTracksByIds([trackId])
  if (!track) throw new Error('Track not found after update')
  return track
}
