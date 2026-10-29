import type { AlbumRow, ArtistSpotlight, RelatedTracksResult, TrackRow } from '../../../shared/types'
import { getDb } from '../../db/database'
import { artworkKeyFromPath } from './artwork'
import { listTracksByIds, queryTracks } from './queries'

function trackRow(id: string): TrackRow | null {
  const rows = listTracksByIds([id])
  return rows[0] ?? null
}

/** Local related music: same artist, album, then genre — never leaves the library. */
export function getRelatedTracks(trackId: string, limit = 8): RelatedTracksResult {
  const track = trackRow(trackId)
  if (!track) {
    return { trackId, sameArtist: [], sameAlbum: [], sameGenre: [] }
  }

  const sameArtist = track.artistId
    ? queryTracks({
        artistId: track.artistId,
        sort: 'title',
        limit: limit + 1
      })
        .tracks.filter((item) => item.id !== trackId)
        .slice(0, limit)
    : []

  const sameAlbum = track.albumId
    ? queryTracks({
        albumId: track.albumId,
        sort: 'track_number',
        limit: limit + 1
      })
        .tracks.filter((item) => item.id !== trackId)
        .slice(0, limit)
    : []

  const used = new Set([trackId, ...sameArtist.map((t) => t.id), ...sameAlbum.map((t) => t.id)])
  let sameGenre: TrackRow[] = []
  if (track.genre) {
    sameGenre = queryTracks({
      genre: track.genre,
      sort: 'title',
      limit: limit * 3
    })
      .tracks.filter((item) => !used.has(item.id))
      .slice(0, limit)
  }

  return { trackId, sameArtist, sameAlbum, sameGenre }
}

export function getArtistSpotlight(artistId: string | null, artistName: string): ArtistSpotlight {
  if (!artistId) {
    return {
      id: null,
      name: artistName || 'Unknown Artist',
      trackCount: 0,
      albumCount: 0,
      albums: [],
      topTracks: []
    }
  }

  const db = getDb()
  const counts = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM tracks t WHERE t.artist_id = ? AND t.missing = 0) AS track_count,
         (SELECT COUNT(DISTINCT t.album_id) FROM tracks t
           WHERE t.artist_id = ? AND t.missing = 0 AND t.album_id IS NOT NULL) AS album_count`
    )
    .get(artistId, artistId) as { track_count: number; album_count: number }

  const nameRow = db.prepare('SELECT name FROM artists WHERE id = ?').get(artistId) as
    | { name: string }
    | undefined

  const albumRows = db
    .prepare(
      `SELECT al.id, al.title, COALESCE(ar.name, 'Unknown Artist') AS artist_name, al.year,
              (SELECT COUNT(*) FROM tracks t WHERE t.album_id = al.id AND t.missing = 0) AS track_count,
              al.artwork_path
       FROM albums al
       LEFT JOIN artists ar ON ar.id = al.artist_id
       WHERE al.artist_id = ?
       ORDER BY al.year IS NULL, al.year DESC, al.title COLLATE NOCASE
       LIMIT 12`
    )
    .all(artistId) as Array<{
    id: string
    title: string
    artist_name: string
    year: number | null
    track_count: number
    artwork_path: string | null
  }>

  const albums: AlbumRow[] = albumRows.map((row) => ({
    id: row.id,
    title: row.title,
    artistName: row.artist_name,
    year: row.year,
    trackCount: row.track_count,
    artworkKey: artworkKeyFromPath(row.artwork_path)
  }))

  const topTracks = queryTracks({
    artistId,
    sort: 'title',
    limit: 8
  }).tracks

  return {
    id: artistId,
    name: nameRow?.name ?? artistName,
    trackCount: counts.track_count,
    albumCount: counts.album_count,
    albums,
    topTracks
  }
}
