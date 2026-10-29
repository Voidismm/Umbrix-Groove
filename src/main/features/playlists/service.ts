import { randomUUID } from 'crypto'
import type {
  PlaylistDetail,
  PlaylistFolder,
  PlaylistSummary,
  PlaylistTreeItemRef,
  PlaylistTreeNode,
  TrackRow
} from '../../../shared/types'
import { getDb } from '../../db/database'
import { artworkKeyFromPath, saveArtwork } from '../library/artwork'
import { listTracksByIds } from '../library/queries'

const LIKED_KEY = 'liked'
const LIKED_NAME = 'Loved Songs'

type PlaylistRow = {
  id: string
  name: string
  description: string | null
  folder_id: string | null
  position: number
  is_system: number
  system_key: string | null
  cover_key: string | null
  accent_color: string | null
  created_at: string
  updated_at: string
  track_count: number
  total_duration_ms: number
}

type FolderRow = {
  id: string
  name: string
  parent_id: string | null
  position: number
  created_at: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function mapFolder(row: FolderRow): PlaylistFolder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    position: row.position,
    createdAt: row.created_at
  }
}

function mapPlaylist(row: PlaylistRow, coverArtKeys: string[] = []): PlaylistSummary {
  const isLoved = row.system_key === LIKED_KEY || row.name === 'Liked Songs'
  return {
    id: row.id,
    name: isLoved ? LIKED_NAME : row.name,
    description: row.description,
    folderId: row.folder_id,
    position: row.position,
    isSystem: row.is_system === 1,
    systemKey: row.system_key ?? (isLoved ? LIKED_KEY : null),
    coverKey: row.cover_key ?? null,
    coverArtKeys,
    accentColor: row.accent_color ?? null,
    trackCount: row.track_count,
    totalDurationMs: row.total_duration_ms ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/** First up to 4 unique artwork keys in playlist order (tracks that have art). */
function coverArtKeysForPlaylist(playlistId: string): string[] {
  const rows = getDb()
    .prepare(
      `SELECT t.artwork_path
       FROM playlist_tracks pt
       JOIN tracks t ON t.id = pt.track_id
       WHERE pt.playlist_id = ?
       ORDER BY pt.position ASC, pt.added_at ASC`
    )
    .all(playlistId) as Array<{ artwork_path: string | null }>

  const keys: string[] = []
  for (const row of rows) {
    const key = artworkKeyFromPath(row.artwork_path)
    if (key && !keys.includes(key)) keys.push(key)
    if (keys.length >= 4) break
  }
  return keys
}

function loadCoverArtKeysMap(playlistIds: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const id of playlistIds) map.set(id, [])
  if (playlistIds.length === 0) return map

  const placeholders = playlistIds.map(() => '?').join(', ')
  const rows = getDb()
    .prepare(
      `SELECT pt.playlist_id, t.artwork_path
       FROM playlist_tracks pt
       JOIN tracks t ON t.id = pt.track_id
       WHERE pt.playlist_id IN (${placeholders})
       ORDER BY pt.playlist_id, pt.position ASC, pt.added_at ASC`
    )
    .all(...playlistIds) as Array<{ playlist_id: string; artwork_path: string | null }>

  const full = new Set<string>()
  for (const row of rows) {
    if (full.has(row.playlist_id)) continue
    const keys = map.get(row.playlist_id) ?? []
    const key = artworkKeyFromPath(row.artwork_path)
    if (key && !keys.includes(key)) keys.push(key)
    map.set(row.playlist_id, keys)
    if (keys.length >= 4) full.add(row.playlist_id)
  }
  return map
}

function mapPlaylists(rows: PlaylistRow[]): PlaylistSummary[] {
  const art = loadCoverArtKeysMap(rows.map((row) => row.id))
  return rows.map((row) => mapPlaylist(row, art.get(row.id) ?? []))
}

function mappedPlaylist(row: PlaylistRow): PlaylistSummary {
  return mapPlaylist(row, coverArtKeysForPlaylist(row.id))
}

const PLAYLIST_SELECT = `
  SELECT p.id, p.name, p.description, p.folder_id, p.position, p.is_system, p.system_key,
         p.cover_key, p.accent_color, p.created_at, p.updated_at,
         COUNT(pt.track_id) AS track_count,
         COALESCE(SUM(t.duration_ms), 0) AS total_duration_ms
  FROM playlists p
  LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
  LEFT JOIN tracks t ON t.id = pt.track_id
`

/** Ensure the system Loved Songs playlist exists and keeps the current title. */
export function ensureSystemPlaylists(): void {
  const db = getDb()
  const stamp = nowIso()
  const existing = db
    .prepare(
      `SELECT id FROM playlists
       WHERE system_key = ? OR (is_system = 1 AND name IN ('Liked Songs', 'Loved Songs'))
       LIMIT 1`
    )
    .get(LIKED_KEY) as { id: string } | undefined

  if (existing) {
    // Always pin Loved Songs to root top — never leave it inside a user folder.
    db.prepare(
      `UPDATE playlists
       SET name = ?, description = ?, folder_id = NULL, position = 0,
           is_system = 1, system_key = ?, updated_at = ?
       WHERE id = ?`
    ).run(LIKED_NAME, 'Tracks you marked as favorites.', LIKED_KEY, stamp, existing.id)
    // Catch any leftover copies still titled Liked Songs
    db.prepare(`UPDATE playlists SET name = ? WHERE name = 'Liked Songs'`).run(LIKED_NAME)
    return
  }

  db.prepare(
    `INSERT INTO playlists (id, name, description, folder_id, position, is_system, system_key, created_at, updated_at)
     VALUES (?, ?, ?, NULL, 0, 1, ?, ?, ?)`
  ).run(randomUUID(), LIKED_NAME, 'Tracks you marked as favorites.', LIKED_KEY, stamp, stamp)
}

function isLovedPlaylist(playlist: PlaylistSummary): boolean {
  return playlist.isSystem || playlist.systemKey === LIKED_KEY
}

/** Next position among folders + user playlists under the same parent. */
function nextSiblingPosition(parentId: string | null): number {
  const db = getDb()
  const folderRow = db
    .prepare(
      parentId
        ? 'SELECT COALESCE(MAX(position), -1) AS n FROM playlist_folders WHERE parent_id = ?'
        : 'SELECT COALESCE(MAX(position), -1) AS n FROM playlist_folders WHERE parent_id IS NULL'
    )
    .get(...(parentId ? [parentId] : [])) as { n: number }
  const playlistRow = db
    .prepare(
      parentId
        ? `SELECT COALESCE(MAX(position), -1) AS n FROM playlists
           WHERE folder_id = ? AND is_system = 0`
        : `SELECT COALESCE(MAX(position), -1) AS n FROM playlists
           WHERE folder_id IS NULL AND is_system = 0`
    )
    .get(...(parentId ? [parentId] : [])) as { n: number }
  return Math.max(folderRow.n, playlistRow.n) + 1
}

function listMovableSiblings(parentId: string | null): PlaylistTreeItemRef[] {
  const db = getDb()
  const folders = db
    .prepare(
      parentId
        ? 'SELECT id, position, name FROM playlist_folders WHERE parent_id = ?'
        : 'SELECT id, position, name FROM playlist_folders WHERE parent_id IS NULL'
    )
    .all(...(parentId ? [parentId] : [])) as Array<{ id: string; position: number; name: string }>
  const playlists = db
    .prepare(
      parentId
        ? `SELECT id, position, name FROM playlists WHERE folder_id = ? AND is_system = 0`
        : `SELECT id, position, name FROM playlists WHERE folder_id IS NULL AND is_system = 0`
    )
    .all(...(parentId ? [parentId] : [])) as Array<{ id: string; position: number; name: string }>

  return [
    ...folders.map((row) => ({
      type: 'folder' as const,
      id: row.id,
      position: row.position,
      name: row.name
    })),
    ...playlists.map((row) => ({
      type: 'playlist' as const,
      id: row.id,
      position: row.position,
      name: row.name
    }))
  ]
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map(({ type, id }) => ({ type, id }))
}

function touchPlaylist(playlistId: string): void {
  getDb()
    .prepare('UPDATE playlists SET updated_at = ? WHERE id = ?')
    .run(nowIso(), playlistId)
}

function getPlaylistRow(id: string): PlaylistRow | undefined {
  return getDb()
    .prepare(`${PLAYLIST_SELECT} WHERE p.id = ? GROUP BY p.id`)
    .get(id) as PlaylistRow | undefined
}

function folderWouldCycle(folderId: string, newParentId: string | null): boolean {
  if (!newParentId) return false
  if (newParentId === folderId) return true
  const db = getDb()
  let current: string | null = newParentId
  const seen = new Set<string>()
  while (current) {
    if (current === folderId) return true
    if (seen.has(current)) return true
    seen.add(current)
    const row = db
      .prepare('SELECT parent_id FROM playlist_folders WHERE id = ?')
      .get(current) as { parent_id: string | null } | undefined
    current = row?.parent_id ?? null
  }
  return false
}

export function listPlaylistFolders(): PlaylistFolder[] {
  ensureSystemPlaylists()
  const rows = getDb()
    .prepare(
      'SELECT id, name, parent_id, position, created_at FROM playlist_folders ORDER BY position, name COLLATE NOCASE'
    )
    .all() as FolderRow[]
  return rows.map(mapFolder)
}

export function listPlaylists(): PlaylistSummary[] {
  ensureSystemPlaylists()
  const rows = getDb()
    .prepare(`${PLAYLIST_SELECT} GROUP BY p.id ORDER BY p.is_system DESC, p.position, p.name COLLATE NOCASE`)
    .all() as PlaylistRow[]
  return mapPlaylists(rows)
}

export function getPlaylistTree(): PlaylistTreeNode[] {
  ensureSystemPlaylists()
  const folders = listPlaylistFolders()
  const playlists = listPlaylists()

  const folderNodes = new Map<string, PlaylistTreeNode>()
  for (const folder of folders) {
    folderNodes.set(folder.id, {
      type: 'folder',
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      position: folder.position,
      children: []
    })
  }

  const roots: PlaylistTreeNode[] = []

  for (const folder of folders) {
    const node = folderNodes.get(folder.id)!
    if (folder.parentId && folderNodes.has(folder.parentId)) {
      folderNodes.get(folder.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  for (const playlist of playlists) {
    const loved = isLovedPlaylist(playlist)
    const node: PlaylistTreeNode = {
      type: 'playlist',
      id: playlist.id,
      name: playlist.name,
      // System playlists never nest under folders, even if folder_id was dirty.
      parentId: loved ? null : playlist.folderId,
      position: loved ? 0 : playlist.position,
      playlist,
      children: []
    }
    if (!loved && playlist.folderId && folderNodes.has(playlist.folderId)) {
      folderNodes.get(playlist.folderId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (nodes: PlaylistTreeNode[]): void => {
    nodes.sort((a, b) => {
      const aLoved = a.type === 'playlist' && !!a.playlist && isLovedPlaylist(a.playlist)
      const bLoved = b.type === 'playlist' && !!b.playlist && isLovedPlaylist(b.playlist)
      // Loved Songs always first in this rail.
      if (aLoved !== bLoved) return aLoved ? -1 : 1
      if (a.position !== b.position) return a.position - b.position
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    for (const node of nodes) sortNodes(node.children)
  }
  sortNodes(roots)
  return roots
}

export function createPlaylistFolder(name: string, parentId: string | null = null): PlaylistFolder {
  ensureSystemPlaylists()
  const clean = name.trim() || 'New Folder'
  if (parentId) {
    const parent = getDb()
      .prepare('SELECT id FROM playlist_folders WHERE id = ?')
      .get(parentId)
    if (!parent) throw new Error('Parent folder not found')
  }
  const id = randomUUID()
  const createdAt = nowIso()
  const position = nextSiblingPosition(parentId)
  getDb()
    .prepare(
      'INSERT INTO playlist_folders (id, name, parent_id, position, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(id, clean, parentId, position, createdAt)
  return { id, name: clean, parentId, position, createdAt }
}

export function renamePlaylistFolder(folderId: string, name: string): PlaylistFolder {
  const clean = name.trim()
  if (!clean) throw new Error('Folder name is required')
  const db = getDb()
  const result = db
    .prepare('UPDATE playlist_folders SET name = ? WHERE id = ?')
    .run(clean, folderId)
  if (result.changes === 0) throw new Error('Folder not found')
  const row = db
    .prepare('SELECT id, name, parent_id, position, created_at FROM playlist_folders WHERE id = ?')
    .get(folderId) as FolderRow
  return mapFolder(row)
}

export function movePlaylistFolder(folderId: string, parentId: string | null): PlaylistFolder {
  if (folderWouldCycle(folderId, parentId)) {
    throw new Error('Cannot move a folder into itself or one of its children')
  }
  if (parentId) {
    const parent = getDb()
      .prepare('SELECT id FROM playlist_folders WHERE id = ?')
      .get(parentId)
    if (!parent) throw new Error('Parent folder not found')
  }
  const position = nextSiblingPosition(parentId)
  const result = getDb()
    .prepare('UPDATE playlist_folders SET parent_id = ?, position = ? WHERE id = ?')
    .run(parentId, position, folderId)
  if (result.changes === 0) throw new Error('Folder not found')
  const row = getDb()
    .prepare('SELECT id, name, parent_id, position, created_at FROM playlist_folders WHERE id = ?')
    .get(folderId) as FolderRow
  return mapFolder(row)
}

export function deletePlaylistFolder(folderId: string): { ok: boolean } {
  const db = getDb()
  // Playlists inside become root (ON DELETE SET NULL). Nested folders cascade.
  const result = db.prepare('DELETE FROM playlist_folders WHERE id = ?').run(folderId)
  return { ok: result.changes > 0 }
}

export function createPlaylist(
  name: string,
  folderId: string | null = null,
  description: string | null = null
): PlaylistSummary {
  ensureSystemPlaylists()
  const clean = name.trim() || 'New Playlist'
  if (folderId) {
    const folder = getDb()
      .prepare('SELECT id FROM playlist_folders WHERE id = ?')
      .get(folderId)
    if (!folder) throw new Error('Folder not found')
  }
  const id = randomUUID()
  const stamp = nowIso()
  const position = nextSiblingPosition(folderId)
  getDb()
    .prepare(
      `INSERT INTO playlists (id, name, description, folder_id, position, is_system, system_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)`
    )
    .run(id, clean, description?.trim() || null, folderId, position, stamp, stamp)
  const created = getPlaylistRow(id)!
  return mapPlaylist(created, coverArtKeysForPlaylist(created.id))
}

export function renamePlaylist(playlistId: string, name: string): PlaylistSummary {
  const row = getPlaylistRow(playlistId)
  if (!row) throw new Error('Playlist not found')
  if (row.is_system === 1) throw new Error('System playlists cannot be renamed')
  const clean = name.trim()
  if (!clean) throw new Error('Playlist name is required')
  getDb()
    .prepare('UPDATE playlists SET name = ?, updated_at = ? WHERE id = ?')
    .run(clean, nowIso(), playlistId)
  const next = getPlaylistRow(playlistId)!
  return mapPlaylist(next, coverArtKeysForPlaylist(next.id))
}

export function setPlaylistDescription(playlistId: string, description: string | null): PlaylistSummary {
  const row = getPlaylistRow(playlistId)
  if (!row) throw new Error('Playlist not found')
  getDb()
    .prepare('UPDATE playlists SET description = ?, updated_at = ? WHERE id = ?')
    .run(description?.trim() || null, nowIso(), playlistId)
  const next = getPlaylistRow(playlistId)!
  return mapPlaylist(next, coverArtKeysForPlaylist(next.id))
}

export function setPlaylistCover(playlistId: string, coverKey: string | null): PlaylistSummary {
  const row = getPlaylistRow(playlistId)
  if (!row) throw new Error('Playlist not found')
  getDb()
    .prepare('UPDATE playlists SET cover_key = ?, updated_at = ? WHERE id = ?')
    .run(coverKey, nowIso(), playlistId)
  const next = getPlaylistRow(playlistId)!
  return mapPlaylist(next, coverArtKeysForPlaylist(next.id))
}

export function setPlaylistCoverFromBuffer(
  playlistId: string,
  data: Buffer,
  mime?: string
): PlaylistSummary {
  if (!data.length) throw new Error('Empty image')
  const key = saveArtwork(data, mime)
  return setPlaylistCover(playlistId, key)
}

export function clearPlaylistCover(playlistId: string): PlaylistSummary {
  return setPlaylistCover(playlistId, null)
}

function normalizeAccentColor(value: string | null): string | null {
  if (value == null) return null
  const raw = value.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(raw) && !/^[0-9a-fA-F]{3}$/.test(raw)) {
    throw new Error('Accent color must be a hex value like #6b3aad')
  }
  const hex =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw
  return `#${hex.toLowerCase()}`
}

export function setPlaylistAccentColor(
  playlistId: string,
  accentColor: string | null
): PlaylistSummary {
  const row = getPlaylistRow(playlistId)
  if (!row) throw new Error('Playlist not found')
  const clean = normalizeAccentColor(accentColor)
  getDb()
    .prepare('UPDATE playlists SET accent_color = ?, updated_at = ? WHERE id = ?')
    .run(clean, nowIso(), playlistId)
  return mappedPlaylist(getPlaylistRow(playlistId)!)
}

export function movePlaylist(playlistId: string, folderId: string | null): PlaylistSummary {
  const row = getPlaylistRow(playlistId)
  if (!row) throw new Error('Playlist not found')
  if ((row.is_system === 1 || row.system_key === LIKED_KEY) && folderId) {
    throw new Error('Loved Songs stays at the root')
  }
  if (folderId) {
    const folder = getDb()
      .prepare('SELECT id FROM playlist_folders WHERE id = ?')
      .get(folderId)
    if (!folder) throw new Error('Folder not found')
  }
  const position = nextSiblingPosition(folderId)
  getDb()
    .prepare('UPDATE playlists SET folder_id = ?, position = ?, updated_at = ? WHERE id = ?')
    .run(folderId, position, nowIso(), playlistId)
  const next = getPlaylistRow(playlistId)!
  return mapPlaylist(next, coverArtKeysForPlaylist(next.id))
}

/**
 * Move a playlist/folder under a parent and insert it at `index`
 * among that parent's movable siblings (Loved Songs stays pinned at root top).
 */
export function placeTreeItem(
  item: PlaylistTreeItemRef,
  parentId: string | null,
  index: number
): PlaylistTreeNode[] {
  ensureSystemPlaylists()
  const db = getDb()

  if (item.type === 'playlist') {
    const row = getPlaylistRow(item.id)
    if (!row) throw new Error('Playlist not found')
    if (row.is_system === 1 || row.system_key === LIKED_KEY) {
      throw new Error('Loved Songs stays at the root')
    }
    if (parentId) {
      const folder = db.prepare('SELECT id FROM playlist_folders WHERE id = ?').get(parentId)
      if (!folder) throw new Error('Folder not found')
    }
  } else {
    if (folderWouldCycle(item.id, parentId)) {
      throw new Error('Cannot move a folder into itself or one of its children')
    }
    if (parentId) {
      const folder = db.prepare('SELECT id FROM playlist_folders WHERE id = ?').get(parentId)
      if (!folder) throw new Error('Folder not found')
    }
  }

  const siblings = listMovableSiblings(parentId).filter(
    (entry) => !(entry.type === item.type && entry.id === item.id)
  )
  const clamped = Math.max(0, Math.min(Math.floor(index), siblings.length))
  siblings.splice(clamped, 0, item)

  const tx = db.transaction(() => {
    const base = parentId === null ? 1 : 0
    for (let i = 0; i < siblings.length; i += 1) {
      const sibling = siblings[i]
      const position = base + i
      if (sibling.type === 'playlist') {
        db.prepare(
          'UPDATE playlists SET folder_id = ?, position = ?, updated_at = ? WHERE id = ? AND is_system = 0'
        ).run(parentId, position, nowIso(), sibling.id)
      } else {
        db.prepare('UPDATE playlist_folders SET parent_id = ?, position = ? WHERE id = ?').run(
          parentId,
          position,
          sibling.id
        )
      }
    }
    if (parentId === null) {
      db.prepare(
        `UPDATE playlists
         SET folder_id = NULL, position = 0, updated_at = ?
         WHERE system_key = ? OR (is_system = 1 AND name = ?)`
      ).run(nowIso(), LIKED_KEY, LIKED_NAME)
    }
  })
  tx()
  return getPlaylistTree()
}

export function deletePlaylist(playlistId: string): { ok: boolean } {
  const row = getPlaylistRow(playlistId)
  if (!row) return { ok: false }
  if (row.is_system === 1) throw new Error('System playlists cannot be deleted')
  getDb().prepare('DELETE FROM playlists WHERE id = ?').run(playlistId)
  return { ok: true }
}

export function getPlaylistDetail(playlistId: string): PlaylistDetail {
  ensureSystemPlaylists()
  const row = getPlaylistRow(playlistId)
  if (!row) throw new Error('Playlist not found')
  const trackIds = (
    getDb()
      .prepare(
        'SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC, added_at ASC'
      )
      .all(playlistId) as Array<{ track_id: string }>
  ).map((item) => item.track_id)

  return {
    ...mappedPlaylist(row),
    trackIds
  }
}

export function getPlaylistTracks(playlistId: string): TrackRow[] {
  const detail = getPlaylistDetail(playlistId)
  return listTracksByIds(detail.trackIds)
}

export function addTracksToPlaylist(
  playlistId: string,
  trackIds: string[]
): { added: number; playlist: PlaylistSummary } {
  const row = getPlaylistRow(playlistId)
  if (!row) throw new Error('Playlist not found')
  const db = getDb()
  const unique = [...new Set(trackIds.filter(Boolean))]
  if (unique.length === 0) {
    return { added: 0, playlist: mappedPlaylist(row) }
  }

  const existing = new Set(
    (
      db
        .prepare('SELECT track_id FROM playlist_tracks WHERE playlist_id = ?')
        .all(playlistId) as Array<{ track_id: string }>
    ).map((item) => item.track_id)
  )

  const start = (
    db
      .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM playlist_tracks WHERE playlist_id = ?')
      .get(playlistId) as { n: number }
  ).n

  const insert = db.prepare(
    'INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)'
  )
  const stamp = nowIso()
  let added = 0
  let position = start
  const run = db.transaction(() => {
    for (const trackId of unique) {
      if (existing.has(trackId)) continue
      const track = db.prepare('SELECT id FROM tracks WHERE id = ?').get(trackId)
      if (!track) continue
      insert.run(playlistId, trackId, position, stamp)
      position += 1
      added += 1
    }
    if (added > 0) touchPlaylist(playlistId)
  })
  run()
  return { added, playlist: mappedPlaylist(getPlaylistRow(playlistId)!) }
}

export function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string
): { ok: boolean; playlist: PlaylistSummary } {
  const row = getPlaylistRow(playlistId)
  if (!row) throw new Error('Playlist not found')
  const result = getDb()
    .prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?')
    .run(playlistId, trackId)
  if (result.changes > 0) {
    reindexPlaylist(playlistId)
    touchPlaylist(playlistId)
  }
  return { ok: result.changes > 0, playlist: mappedPlaylist(getPlaylistRow(playlistId)!) }
}

function reindexPlaylist(playlistId: string): void {
  const db = getDb()
  const rows = db
    .prepare(
      'SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC, added_at ASC'
    )
    .all(playlistId) as Array<{ track_id: string }>
  const update = db.prepare(
    'UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?'
  )
  const run = db.transaction(() => {
    rows.forEach((row, index) => update.run(index, playlistId, row.track_id))
  })
  run()
}

export function reorderPlaylistTracks(playlistId: string, trackIds: string[]): PlaylistDetail {
  const row = getPlaylistRow(playlistId)
  if (!row) throw new Error('Playlist not found')
  const db = getDb()
  const existing = (
    db
      .prepare('SELECT track_id FROM playlist_tracks WHERE playlist_id = ?')
      .all(playlistId) as Array<{ track_id: string }>
  ).map((item) => item.track_id)

  if (existing.length !== trackIds.length) {
    throw new Error('Track list does not match playlist contents')
  }
  const existingSet = new Set(existing)
  for (const id of trackIds) {
    if (!existingSet.has(id)) throw new Error('Track list does not match playlist contents')
  }

  const update = db.prepare(
    'UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?'
  )
  const run = db.transaction(() => {
    trackIds.forEach((trackId, index) => update.run(index, playlistId, trackId))
    touchPlaylist(playlistId)
  })
  run()
  return getPlaylistDetail(playlistId)
}

export function getLikedPlaylistId(): string {
  ensureSystemPlaylists()
  const row = getDb()
    .prepare('SELECT id FROM playlists WHERE system_key = ?')
    .get(LIKED_KEY) as { id: string }
  return row.id
}

export function getLikedTrackIds(): string[] {
  return getPlaylistDetail(getLikedPlaylistId()).trackIds
}

export function setTrackLiked(trackId: string, liked: boolean): { liked: boolean } {
  const playlistId = getLikedPlaylistId()
  if (liked) {
    addTracksToPlaylist(playlistId, [trackId])
  } else {
    removeTrackFromPlaylist(playlistId, trackId)
  }
  return { liked }
}

export function getTrackRating(trackId: string): number | null {
  const row = getDb()
    .prepare('SELECT rating FROM track_ratings WHERE track_id = ?')
    .get(trackId) as { rating: number } | undefined
  return row?.rating ?? null
}

export function setTrackRating(trackId: string, rating: number | null): { rating: number | null } {
  const db = getDb()
  const track = db.prepare('SELECT id FROM tracks WHERE id = ?').get(trackId)
  if (!track) throw new Error('Track not found')

  if (rating == null || rating <= 0) {
    db.prepare('DELETE FROM track_ratings WHERE track_id = ?').run(trackId)
    return { rating: null }
  }
  const clamped = Math.max(1, Math.min(5, Math.round(rating)))
  db.prepare(
    `INSERT INTO track_ratings (track_id, rating, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(track_id) DO UPDATE SET rating = excluded.rating, updated_at = excluded.updated_at`
  ).run(trackId, clamped, nowIso())
  return { rating: clamped }
}

export function getTrackTags(trackId: string): string[] {
  return (
    getDb()
      .prepare('SELECT tag FROM track_tags WHERE track_id = ? ORDER BY tag COLLATE NOCASE')
      .all(trackId) as Array<{ tag: string }>
  ).map((row) => row.tag)
}

export function setTrackTags(trackId: string, tags: string[]): string[] {
  const db = getDb()
  const track = db.prepare('SELECT id FROM tracks WHERE id = ?').get(trackId)
  if (!track) throw new Error('Track not found')

  const cleaned = [
    ...new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.slice(0, 64))
    )
  ]

  const run = db.transaction(() => {
    db.prepare('DELETE FROM track_tags WHERE track_id = ?').run(trackId)
    const insert = db.prepare('INSERT INTO track_tags (track_id, tag) VALUES (?, ?)')
    for (const tag of cleaned) insert.run(trackId, tag)
  })
  run()
  return getTrackTags(trackId)
}

export function getRatingsMap(trackIds: string[]): Record<string, number> {
  if (trackIds.length === 0) return {}
  const db = getDb()
  const placeholders = trackIds.map(() => '?').join(', ')
  const rows = db
    .prepare(`SELECT track_id, rating FROM track_ratings WHERE track_id IN (${placeholders})`)
    .all(...trackIds) as Array<{ track_id: string; rating: number }>
  const map: Record<string, number> = {}
  for (const row of rows) map[row.track_id] = row.rating
  return map
}
