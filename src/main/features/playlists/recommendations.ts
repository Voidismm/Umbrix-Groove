import type { TrackRow } from '../../../shared/types'
import { getDb } from '../../db/database'
import { mapTrack } from '../library/queries'
import { getPlaylistTracks } from './service'

const GENRE_FAMILIES: Array<{ key: string; synonyms: string[]; match: RegExp }> = [
  {
    key: 'hip-hop',
    synonyms: ['hip hop', 'hip-hop', 'rap', 'trap', 'grime'],
    match: /\b(hip[\s-]?hop|rap|trap|grime)\b/i
  },
  {
    key: 'rnb',
    synonyms: ['r&b', 'rnb', 'rhythm and blues', 'neo-soul', 'neo soul', 'soul'],
    match: /\b(r&b|rnb|rhythm and blues|neo[\s-]?soul|soul)\b/i
  },
  {
    key: 'rock',
    synonyms: ['rock', 'metal', 'punk', 'grunge', 'alternative', 'hardcore'],
    match: /\b(rock|metal|punk|grunge|alternative|hardcore)\b/i
  },
  {
    key: 'pop',
    synonyms: ['pop', 'dance pop', 'synth-pop', 'synthpop', 'k-pop', 'kpop'],
    match: /\b(pop|dance pop|synth[\s-]?pop|k-?pop)\b/i
  },
  {
    key: 'electronic',
    synonyms: [
      'electronic',
      'edm',
      'house',
      'techno',
      'trance',
      'dubstep',
      'ambient',
      'drum and bass',
      'dnb'
    ],
    match: /\b(electronic|edm|house|techno|trance|dubstep|ambient|drum and bass|dnb)\b/i
  },
  {
    key: 'jazz',
    synonyms: ['jazz', 'bebop', 'swing'],
    match: /\b(jazz|bebop|swing)\b/i
  },
  {
    key: 'classical',
    synonyms: ['classical', 'orchestral', 'opera', 'baroque'],
    match: /\b(classical|orchestral|opera|baroque)\b/i
  },
  {
    key: 'country',
    synonyms: ['country', 'americana', 'bluegrass', 'folk'],
    match: /\b(country|americana|bluegrass|folk)\b/i
  },
  {
    key: 'blues',
    synonyms: ['blues'],
    match: /\bblues\b/i
  },
  {
    key: 'reggae',
    synonyms: ['reggae', 'ska', 'dancehall'],
    match: /\b(reggae|ska|dancehall)\b/i
  },
  {
    key: 'latin',
    synonyms: ['latin', 'reggaeton', 'salsa', 'bachata', 'cumbia'],
    match: /\b(latin|reggaeton|salsa|bachata|cumbia)\b/i
  },
  {
    key: 'indie',
    synonyms: ['indie', 'lo-fi', 'lofi'],
    match: /\b(indie|lo-?fi|lofi)\b/i
  }
]

type JoinRow = Parameters<typeof mapTrack>[0] & {
  play_count: number
}

function genreKey(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const text = raw.trim()
  for (const family of GENRE_FAMILIES) {
    if (family.match.test(text)) return family.key
  }
  const token = text
    .split(/[,;/|]/)[0]
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return token || null
}

/** LIKE patterns broad enough that one seed genre still finds cousins. */
function genreLikePatterns(keys: string[], rawGenres: string[]): string[] {
  const patterns = new Set<string>()
  for (const key of keys) {
    patterns.add(`%${key.replace(/-/g, '%')}%`)
    const family = GENRE_FAMILIES.find((item) => item.key === key)
    if (family) {
      for (const syn of family.synonyms) {
        patterns.add(`%${syn.toLowerCase()}%`)
      }
    }
  }
  for (const raw of rawGenres) {
    const token = raw
      .split(/[,;/|]/)[0]
      .trim()
      .toLowerCase()
    if (token.length >= 2) patterns.add(`%${token}%`)
  }
  return [...patterns]
}

/** True when candidate genre sits in the same vibe family as the seeds. */
function genreMatchesSeed(
  candidateGenre: string | null | undefined,
  genreWeights: Map<string, number>,
  rawGenres: string[]
): boolean {
  const text = candidateGenre?.trim() ?? ''
  if (!text) return false
  const key = genreKey(text)
  if (key && genreWeights.has(key)) return true
  for (const seedKey of genreWeights.keys()) {
    const family = GENRE_FAMILIES.find((item) => item.key === seedKey)
    if (family?.match.test(text)) return true
  }
  const lower = text.toLowerCase()
  for (const raw of rawGenres) {
    const token = raw
      .split(/[,;/|]/)[0]
      .trim()
      .toLowerCase()
    if (token.length >= 3 && lower.includes(token)) return true
  }
  return false
}

function decadeOf(year: number | null | undefined): number | null {
  if (year == null || year < 1920 || year > 2100) return null
  return Math.floor(year / 10) * 10
}

function bump(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount)
}

function inClause(column: string, ids: string[]): { sql: string; params: string[] } {
  if (ids.length === 0) return { sql: '0', params: [] }
  return {
    sql: `${column} IN (${ids.map(() => '?').join(', ')})`,
    params: ids
  }
}

/** Tiny seeded RNG so Refresh can reshuffle without leaving the vibe band. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type PlaylistRecommendationOptions = {
  /** Prefer not re-showing these (e.g. the previous Recommended batch). */
  excludeIds?: string[]
  /** Changes ranking jitter so Refresh yields a fresh batch. */
  salt?: number
}

/**
 * Local recommendations for a playlist — scored by shared genre / artist / decade.
 * One seed track is enough; suggestions stay in a similar vibe and never leave the library.
 */
export function getPlaylistRecommendations(
  playlistId: string,
  limit = 18,
  options: PlaylistRecommendationOptions = {}
): TrackRow[] {
  const seeds = getPlaylistTracks(playlistId).filter((track) => !track.missing)
  // A single song is a valid vibe seed.
  if (seeds.length === 0) return []

  const exclude = new Set(seeds.map((track) => track.id))
  const softExclude = new Set(
    (options.excludeIds ?? []).filter((id) => typeof id === 'string' && id.length > 0)
  )
  const salt =
    typeof options.salt === 'number' && Number.isFinite(options.salt)
      ? Math.floor(options.salt)
      : 0
  const genreWeights = new Map<string, number>()
  const artistWeights = new Map<string, number>()
  const artistNameWeights = new Map<string, number>()
  const decadeWeights = new Map<string, number>()
  const albumWeights = new Map<string, number>()
  const rawGenres: string[] = []

  for (const track of seeds) {
    const genre = genreKey(track.genre)
    if (genre) bump(genreWeights, genre)
    if (track.genre?.trim()) rawGenres.push(track.genre.trim())
    if (track.artistId) bump(artistWeights, track.artistId)
    const artistName = track.artistName?.trim().toLowerCase()
    if (artistName && artistName !== 'unknown artist') bump(artistNameWeights, artistName)
    if (track.albumId) bump(albumWeights, track.albumId)
    const decade = decadeOf(track.year)
    if (decade != null) bump(decadeWeights, String(decade))
  }

  if (
    genreWeights.size === 0 &&
    artistWeights.size === 0 &&
    artistNameWeights.size === 0 &&
    albumWeights.size === 0
  ) {
    return []
  }

  const topGenres = [...genreWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key]) => key)
  const topArtists = [...artistWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([key]) => key)
  const topArtistNames = [...artistNameWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([key]) => key)
  const topAlbums = [...albumWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key]) => key)

  const db = getDb()
  const artistIn = inClause('t.artist_id', topArtists)
  const albumIn = inClause('t.album_id', topAlbums)
  const artistNameIn = inClause('LOWER(ar.name)', topArtistNames)
  const likePatterns = genreLikePatterns(topGenres, rawGenres)
  const genreLikes = likePatterns.map(() => `LOWER(COALESCE(t.genre, '')) LIKE ?`).join(' OR ')
  const genreClause = likePatterns.length > 0 ? `(${genreLikes})` : '0'
  const excludeList = [...exclude]
  const excludeClause =
    excludeList.length > 0
      ? `t.id NOT IN (${excludeList.map(() => '?').join(', ')})`
      : '1'

  const sql = `
    SELECT t.id, t.path, t.title, COALESCE(ar.name, 'Unknown Artist') AS artist_name,
           COALESCE(al.title, 'Unknown Album') AS album_title,
           t.album_id, t.artist_id, t.track_number, t.disc_number, t.year, t.genre,
           t.duration_ms, t.bitrate, t.codec, t.artwork_path, t.missing, t.date_added,
           COALESCE(t.play_count, 0) AS play_count
    FROM tracks t
    LEFT JOIN artists ar ON ar.id = t.artist_id
    LEFT JOIN albums al ON al.id = t.album_id
    WHERE t.missing = 0
      AND ${excludeClause}
      AND (${artistIn.sql} OR ${albumIn.sql} OR ${artistNameIn.sql} OR ${genreClause})
    LIMIT 400
  `

  const params: unknown[] = [
    ...excludeList,
    ...artistIn.params,
    ...albumIn.params,
    ...artistNameIn.params,
    ...likePatterns
  ]

  let rows: JoinRow[]
  try {
    rows = db.prepare(sql).all(...params) as JoinRow[]
  } catch {
    // Fall back to artist + album only if genre patterns blow up.
    if (
      topArtists.length === 0 &&
      topAlbums.length === 0 &&
      topArtistNames.length === 0
    ) {
      return []
    }
    const fallback = `
      SELECT t.id, t.path, t.title, COALESCE(ar.name, 'Unknown Artist') AS artist_name,
             COALESCE(al.title, 'Unknown Album') AS album_title,
             t.album_id, t.artist_id, t.track_number, t.disc_number, t.year, t.genre,
             t.duration_ms, t.bitrate, t.codec, t.artwork_path, t.missing, t.date_added,
             COALESCE(t.play_count, 0) AS play_count
      FROM tracks t
      LEFT JOIN artists ar ON ar.id = t.artist_id
      LEFT JOIN albums al ON al.id = t.album_id
      WHERE t.missing = 0
        AND ${excludeClause}
        AND (${artistIn.sql} OR ${albumIn.sql} OR ${artistNameIn.sql})
      LIMIT 400
    `
    rows = db
      .prepare(fallback)
      .all(
        ...excludeList,
        ...artistIn.params,
        ...albumIn.params,
        ...artistNameIn.params
      ) as JoinRow[]
  }

  const maxGenre = Math.max(1, ...genreWeights.values())
  const maxArtist = Math.max(1, ...artistWeights.values())
  const maxArtistName = Math.max(1, ...artistNameWeights.values())
  const maxDecade = Math.max(1, ...decadeWeights.values())

  const scored = rows
    .map((row) => {
      const track = mapTrack(row)
      const d = decadeOf(track.year)
      const artistName = track.artistName?.trim().toLowerCase() ?? ''
      let score = 0
      let vibeHit = false

      if (genreMatchesSeed(track.genre, genreWeights, rawGenres)) {
        const g = genreKey(track.genre)
        const weight = (g && genreWeights.get(g)) || maxGenre
        score += 12 * (weight / maxGenre)
        vibeHit = true
      }
      if (track.artistId && artistWeights.has(track.artistId)) {
        score += 9 * (artistWeights.get(track.artistId)! / maxArtist)
        vibeHit = true
      } else if (artistName && artistNameWeights.has(artistName)) {
        score += 9 * (artistNameWeights.get(artistName)! / maxArtistName)
        vibeHit = true
      }
      if (track.albumId && albumWeights.has(track.albumId)) {
        score += 5
        vibeHit = true
      }
      if (d != null && decadeWeights.has(String(d))) {
        // Decade only boosts a real vibe hit — never enough alone.
        score += 3 * (decadeWeights.get(String(d))! / maxDecade)
      }
      score += Math.min(2, Math.log10((row.play_count ?? 0) + 1))

      return { track, score, vibeHit }
    })
    .filter((item) => item.vibeHit && item.score >= 4)

  const rng = mulberry32(salt ^ (seeds.length * 2654435761) ^ playlistId.length)
  const ranked = scored
    .map((item) => ({
      ...item,
      // Soft jitter keeps Refresh interesting without abandoning the vibe band.
      rank: item.score + (salt ? rng() * 3.2 : 0) - (softExclude.has(item.track.id) ? 8 : 0)
    }))
    .sort(
      (a, b) =>
        b.rank - a.rank || a.track.title.localeCompare(b.track.title)
    )

  // Diversify a bit: prefer not stacking too many from one artist.
  const picked: TrackRow[] = []
  const artistCount = new Map<string, number>()
  for (const item of ranked) {
    const artistId = item.track.artistId ?? item.track.artistName
    const count = artistCount.get(artistId) ?? 0
    if (count >= 2) continue
    artistCount.set(artistId, count + 1)
    picked.push(item.track)
    if (picked.length >= limit) break
  }

  // If soft-exclude wiped the batch, retry without it so Refresh never goes blank.
  if (picked.length === 0 && softExclude.size > 0) {
    return getPlaylistRecommendations(playlistId, limit, { salt, excludeIds: [] })
  }

  return picked
}
