import { randomUUID } from 'crypto'
import type { HomePersonalization, LocalMix, PlayedTrackRow, TrackRow } from '../../../shared/types'
import { getDb } from '../../db/database'
import { artworkKeyFromPath } from './artwork'
import { listTracksByIds } from './queries'

const MIX_TTL_MS = 24 * 60 * 60 * 1000
const MIX_TRACK_TARGET = 30
const MIX_MIN_TRACKS = 6
const MIX_LIMIT = 8
const ON_REPEAT_DAYS = 14
const ON_REPEAT_MIN = 3

type TrackMetaRow = {
  id: string
  year: number | null
  genre: string | null
  artwork_path: string | null
  play_count: number
  last_played_at: string | null
}

const GENRE_FAMILIES: Array<{ key: string; label: string; match: RegExp }> = [
  { key: 'hip-hop', label: 'Hip Hop', match: /\b(hip[\s-]?hop|rap|trap|grime)\b/i },
  { key: 'rnb', label: 'R&B', match: /\b(r&b|rnb|rhythm and blues|neo[\s-]?soul|soul)\b/i },
  { key: 'rock', label: 'Rock', match: /\b(rock|metal|punk|grunge|alternative|hardcore)\b/i },
  { key: 'pop', label: 'Pop', match: /\b(pop|dance pop|synth[\s-]?pop|k-?pop)\b/i },
  { key: 'electronic', label: 'Electronic', match: /\b(electronic|edm|house|techno|trance|dubstep|ambient|drum and bass|dnb)\b/i },
  { key: 'jazz', label: 'Jazz', match: /\b(jazz|bebop|swing)\b/i },
  { key: 'classical', label: 'Classical', match: /\b(classical|orchestral|opera|baroque)\b/i },
  { key: 'country', label: 'Country', match: /\b(country|americana|bluegrass|folk)\b/i },
  { key: 'blues', label: 'Blues', match: /\bblues\b/i },
  { key: 'reggae', label: 'Reggae', match: /\b(reggae|ska|dancehall)\b/i },
  { key: 'latin', label: 'Latin', match: /\b(latin|reggaeton|salsa|bachata|cumbia)\b/i },
  { key: 'indie', label: 'Indie', match: /\b(indie|lo-?fi|lofi)\b/i }
]

const MIX_ACCENTS = [
  '#6b3aad',
  '#2f6b6a',
  '#8a3a4a',
  '#3a3d8f',
  '#8a6a2f',
  '#4a3878',
  '#24305c',
  '#6e2a5d'
]

function nowIso(): string {
  return new Date().toISOString()
}

/** Full decade label for mix titles — e.g. 2000s, 1990s (never "00s"). */
function decadeLabel(year: number | null): string | null {
  if (year == null || year < 1920 || year > 2100) return null
  const decade = Math.floor(year / 10) * 10
  return `${decade}s`
}

/** True for short labels like "00s" / "90s". */
function isShortDecadeLabel(label: string): boolean {
  return /^\d{2}s$/i.test(label.trim())
}

/** Expand "00s" → "2000s", "90s" → "1990s"; leave "2000s" alone. */
function expandDecadeLabel(label: string): string {
  const raw = label.trim()
  if (/^\d{4}s$/i.test(raw)) return raw
  if (/^\d{4}'s$/i.test(raw)) return `${raw.slice(0, 4)}s`
  const match = raw.match(/^(\d{2})s$/i)
  if (!match) return raw
  const short = Number(match[1])
  // 00–29 → 2000s/2010s/2020s; 30–99 → 1930s–1990s (music library range).
  const decade = short <= 29 ? 2000 + short : 1900 + short
  return `${decade}s`
}

function expandMixTitle(title: string, decadeRaw: string): string {
  const decade = expandDecadeLabel(decadeRaw)
  if (/^\d{2}s\b/i.test(title)) {
    return title.replace(/^\d{2}s\b/i, decade)
  }
  if (/^\d{4}'s\b/i.test(title)) {
    return title.replace(/^\d{4}'s\b/i, decade)
  }
  return title
}

function hasLegacyDecadeLabels(): boolean {
  const rows = getDb()
    .prepare('SELECT decade_label, title FROM daily_mixes')
    .all() as Array<{ decade_label: string; title: string }>
  return rows.some(
    (row) => isShortDecadeLabel(row.decade_label) || /^\d{2}s\b/i.test(row.title)
  )
}

function genreFamily(raw: string | null): { key: string; label: string } | null {
  if (!raw?.trim()) return null
  const text = raw.trim()
  for (const family of GENRE_FAMILIES) {
    if (family.match.test(text)) return { key: family.key, label: family.label }
  }
  // Fallback: first token cleaned
  const label = text
    .split(/[,;/|]/)[0]
    .trim()
    .replace(/\s+/g, ' ')
  if (!label || label.length < 2) return null
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!key) return null
  return { key, label: label.replace(/\b\w/g, (c) => c.toUpperCase()) }
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

function mapPlayed(
  track: TrackRow,
  playCount: number,
  lastPlayedAt: string | null,
  recentPlayCount?: number
): PlayedTrackRow {
  return {
    ...track,
    playCount,
    lastPlayedAt,
    recentPlayCount
  }
}

/** Count a completed listen for a track. */
export function recordPlay(trackId: string): { ok: boolean; playCount: number } {
  const db = getDb()
  const exists = db
    .prepare('SELECT id FROM tracks WHERE id = ? AND missing = 0')
    .get(trackId) as { id: string } | undefined
  if (!exists) return { ok: false, playCount: 0 }

  const stamp = nowIso()
  const run = db.transaction(() => {
    db.prepare('INSERT INTO play_events (id, track_id, played_at) VALUES (?, ?, ?)').run(
      randomUUID(),
      trackId,
      stamp
    )
    db.prepare(
      `UPDATE tracks
       SET play_count = COALESCE(play_count, 0) + 1,
           last_played_at = ?
       WHERE id = ?`
    ).run(stamp, trackId)
  })
  run()

  const row = db.prepare('SELECT play_count FROM tracks WHERE id = ?').get(trackId) as {
    play_count: number
  }
  return { ok: true, playCount: row.play_count }
}

export function getMostPlayed(limit = 18): PlayedTrackRow[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT t.id, t.play_count, t.last_played_at
       FROM tracks t
       WHERE t.missing = 0 AND COALESCE(t.play_count, 0) > 0
       ORDER BY t.play_count DESC, t.last_played_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{ id: string; play_count: number; last_played_at: string | null }>

  const tracks = listTracksByIds(rows.map((r) => r.id))
  const byId = new Map(tracks.map((t) => [t.id, t]))
  return rows
    .map((row) => {
      const track = byId.get(row.id)
      if (!track) return null
      return mapPlayed(track, row.play_count, row.last_played_at)
    })
    .filter((item): item is PlayedTrackRow => Boolean(item))
}

export function getJumpBackIn(limit = 18): PlayedTrackRow[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT t.id, t.play_count, t.last_played_at
       FROM tracks t
       WHERE t.missing = 0 AND t.last_played_at IS NOT NULL
       ORDER BY t.last_played_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{ id: string; play_count: number; last_played_at: string | null }>

  const tracks = listTracksByIds(rows.map((r) => r.id))
  const byId = new Map(tracks.map((t) => [t.id, t]))
  return rows
    .map((row) => {
      const track = byId.get(row.id)
      if (!track) return null
      return mapPlayed(track, row.play_count ?? 0, row.last_played_at)
    })
    .filter((item): item is PlayedTrackRow => Boolean(item))
}

export function getOnRepeat(limit = 18): PlayedTrackRow[] {
  const db = getDb()
  const since = new Date(Date.now() - ON_REPEAT_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const rows = db
    .prepare(
      `SELECT pe.track_id AS id,
              COUNT(*) AS recent_count,
              t.play_count,
              t.last_played_at
       FROM play_events pe
       JOIN tracks t ON t.id = pe.track_id
       WHERE pe.played_at >= ? AND t.missing = 0
       GROUP BY pe.track_id
       HAVING recent_count >= ?
       ORDER BY recent_count DESC, t.last_played_at DESC
       LIMIT ?`
    )
    .all(since, ON_REPEAT_MIN, limit) as Array<{
    id: string
    recent_count: number
    play_count: number
    last_played_at: string | null
  }>

  const tracks = listTracksByIds(rows.map((r) => r.id))
  const byId = new Map(tracks.map((t) => [t.id, t]))
  return rows
    .map((row) => {
      const track = byId.get(row.id)
      if (!track) return null
      return mapPlayed(track, row.play_count ?? 0, row.last_played_at, row.recent_count)
    })
    .filter((item): item is PlayedTrackRow => Boolean(item))
}

function mixesNeedRefresh(): boolean {
  const db = getDb()
  const row = db
    .prepare('SELECT MIN(generated_at) AS oldest, COUNT(*) AS n FROM daily_mixes')
    .get() as { oldest: string | null; n: number }
  if (!row.n || !row.oldest) return true
  const age = Date.now() - new Date(row.oldest).getTime()
  return !Number.isFinite(age) || age >= MIX_TTL_MS
}

function recentTasteBoost(): Map<string, number> {
  const db = getDb()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const rows = db
    .prepare(
      `SELECT t.year, t.genre, COUNT(*) AS c
       FROM play_events pe
       JOIN tracks t ON t.id = pe.track_id
       WHERE pe.played_at >= ? AND t.missing = 0
       GROUP BY t.year, t.genre`
    )
    .all(since) as Array<{ year: number | null; genre: string | null; c: number }>

  const boost = new Map<string, number>()
  for (const row of rows) {
    const decade = decadeLabel(row.year)
    const genre = genreFamily(row.genre)
    if (!decade || !genre) continue
    const key = `${decade}|${genre.key}`
    boost.set(key, (boost.get(key) ?? 0) + row.c)
  }
  return boost
}

function regenerateDailyMixes(): void {
  const db = getDb()
  const metas = db
    .prepare(
      `SELECT id, year, genre, artwork_path, play_count, last_played_at
       FROM tracks
       WHERE missing = 0`
    )
    .all() as TrackMetaRow[]

  type Bucket = {
    decade: string
    genreKey: string
    genreLabel: string
    trackIds: string[]
    artKeys: string[]
  }

  const buckets = new Map<string, Bucket>()
  for (const meta of metas) {
    const decade = decadeLabel(meta.year)
    const genre = genreFamily(meta.genre)
    if (!decade || !genre) continue
    const key = `${decade}|${genre.key}`
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = {
        decade,
        genreKey: genre.key,
        genreLabel: genre.label,
        trackIds: [],
        artKeys: []
      }
      buckets.set(key, bucket)
    }
    bucket.trackIds.push(meta.id)
    const art = artworkKeyFromPath(meta.artwork_path)
    if (art && !bucket.artKeys.includes(art) && bucket.artKeys.length < 4) {
      bucket.artKeys.push(art)
    }
  }

  const eligible = [...buckets.values()].filter((b) => b.trackIds.length >= MIX_MIN_TRACKS)
  if (eligible.length === 0) {
    db.exec('DELETE FROM daily_mix_tracks; DELETE FROM daily_mixes;')
    return
  }

  const boost = recentTasteBoost()
  eligible.sort((a, b) => {
    const keyA = `${a.decade}|${a.genreKey}`
    const keyB = `${b.decade}|${b.genreKey}`
    const scoreA = (boost.get(keyA) ?? 0) * 10 + a.trackIds.length
    const scoreB = (boost.get(keyB) ?? 0) * 10 + b.trackIds.length
    return scoreB - scoreA
  })

  const picked = eligible.slice(0, MIX_LIMIT)
  const stamp = nowIso()

  const clear = db.transaction(() => {
    db.prepare('DELETE FROM daily_mix_tracks').run()
    db.prepare('DELETE FROM daily_mixes').run()

    const insertMix = db.prepare(
      `INSERT INTO daily_mixes
         (id, title, subtitle, decade_label, genre_key, accent_color, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    const insertTrack = db.prepare(
      `INSERT INTO daily_mix_tracks (mix_id, track_id, position) VALUES (?, ?, ?)`
    )

    picked.forEach((bucket, index) => {
      const id = randomUUID()
      const title = `${bucket.decade} ${bucket.genreLabel}`
      const pool = shuffleInPlace([...bucket.trackIds]).slice(0, MIX_TRACK_TARGET)
      const artists = listTracksByIds(pool.slice(0, 8))
        .map((t) => t.artistName)
        .filter((name, i, arr) => name && arr.indexOf(name) === i)
        .slice(0, 3)
      const subtitle =
        artists.length > 0
          ? `${artists.join(', ')}${pool.length > 3 ? ' and more' : ''}`
          : `${pool.length} songs from your library`
      const accent = MIX_ACCENTS[index % MIX_ACCENTS.length]

      insertMix.run(
        id,
        title,
        subtitle,
        bucket.decade,
        bucket.genreKey,
        accent,
        stamp
      )
      pool.forEach((trackId, position) => insertTrack.run(id, trackId, position))
    })
  })
  clear()
}

function loadDailyMixes(): LocalMix[] {
  const db = getDb()
  const mixes = db
    .prepare(
      `SELECT id, title, subtitle, decade_label, genre_key, accent_color, generated_at
       FROM daily_mixes
       ORDER BY generated_at DESC, title COLLATE NOCASE`
    )
    .all() as Array<{
    id: string
    title: string
    subtitle: string | null
    decade_label: string
    genre_key: string
    accent_color: string | null
    generated_at: string
  }>

  const trackStmt = db.prepare(
    `SELECT track_id FROM daily_mix_tracks WHERE mix_id = ? ORDER BY position ASC`
  )

  return mixes.map((mix) => {
    const ids = (
      trackStmt.all(mix.id) as Array<{ track_id: string }>
    ).map((row) => row.track_id)
    const tracks = listTracksByIds(ids)
    const coverArtKeys: string[] = []
    for (const track of tracks) {
      if (track.artworkKey && !coverArtKeys.includes(track.artworkKey)) {
        coverArtKeys.push(track.artworkKey)
      }
      if (coverArtKeys.length >= 4) break
    }
    const decade = expandDecadeLabel(mix.decade_label)
    return {
      id: mix.id,
      title: expandMixTitle(mix.title, mix.decade_label),
      subtitle: mix.subtitle ?? '',
      decadeLabel: decade,
      genreKey: mix.genre_key,
      accentColor: mix.accent_color ?? MIX_ACCENTS[0],
      generatedAt: mix.generated_at,
      trackCount: tracks.length,
      coverArtKeys,
      tracks
    }
  })
}

export function getDailyMixes(forceRefresh = false): LocalMix[] {
  if (forceRefresh || mixesNeedRefresh() || hasLegacyDecadeLabels()) {
    regenerateDailyMixes()
  }
  return loadDailyMixes()
}

export function getHomePersonalization(): HomePersonalization {
  const dailyMixes = getDailyMixes(false)
  return {
    jumpBackIn: getJumpBackIn(18),
    mostPlayed: getMostPlayed(18),
    onRepeat: getOnRepeat(18),
    dailyMixes,
    mixesGeneratedAt: dailyMixes[0]?.generatedAt ?? null
  }
}
