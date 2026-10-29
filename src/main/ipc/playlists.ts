import { readFileSync } from 'fs'
import { extname } from 'path'
import { BrowserWindow, dialog } from 'electron'
import type {
  PlaylistDetail,
  PlaylistFolder,
  PlaylistSummary,
  PlaylistTreeItemRef,
  PlaylistTreeNode,
  TrackRow
} from '../../shared/types'
import {
  addTracksToPlaylist,
  clearPlaylistCover,
  createPlaylist,
  setPlaylistAccentColor,
  createPlaylistFolder,
  deletePlaylist,
  deletePlaylistFolder,
  ensureSystemPlaylists,
  getLikedTrackIds,
  getPlaylistDetail,
  getPlaylistRecommendations,
  getPlaylistTracks,
  getPlaylistTree,
  getRatingsMap,
  getTrackRating,
  getTrackTags,
  listPlaylists,
  movePlaylist,
  movePlaylistFolder,
  placeTreeItem,
  removeTrackFromPlaylist,
  renamePlaylist,
  renamePlaylistFolder,
  reorderPlaylistTracks,
  setPlaylistCoverFromBuffer,
  setPlaylistDescription,
  setTrackLiked,
  setTrackRating,
  setTrackTags
} from '../features/playlists'
import { handle } from './handle'

function dialogParent(event: Electron.IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow() ?? undefined
}

function mimeFromPath(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    default:
      return 'image/jpeg'
  }
}

function asString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Invalid ${label}`)
  return value
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') throw new Error('Invalid string')
  return value
}

/** Playlist IPC: folders, playlists, likes, ratings, tags. */
export function registerPlaylistIpc(): void {
  ensureSystemPlaylists()

  handle('playlists:getTree', (): PlaylistTreeNode[] => getPlaylistTree())

  handle('playlists:list', (): PlaylistSummary[] => listPlaylists())

  handle('playlists:get', (_event, playlistId: unknown): PlaylistDetail => {
    return getPlaylistDetail(asString(playlistId, 'playlist id'))
  })

  handle('playlists:getTracks', (_event, playlistId: unknown): TrackRow[] => {
    return getPlaylistTracks(asString(playlistId, 'playlist id'))
  })

  handle(
    'playlists:getRecommendations',
    (_event, playlistId: unknown, limit?: unknown, options?: unknown): TrackRow[] => {
      const opts =
        options && typeof options === 'object'
          ? (options as { excludeIds?: unknown; salt?: unknown })
          : {}
      const excludeIds = Array.isArray(opts.excludeIds)
        ? opts.excludeIds.filter((id): id is string => typeof id === 'string')
        : []
      const salt = typeof opts.salt === 'number' && Number.isFinite(opts.salt) ? opts.salt : 0
      return getPlaylistRecommendations(
        asString(playlistId, 'playlist id'),
        typeof limit === 'number' && limit > 0 ? Math.min(40, Math.floor(limit)) : 18,
        { excludeIds, salt }
      )
    }
  )

  handle(
    'playlists:create',
    (_event, name: unknown, folderId?: unknown, description?: unknown): PlaylistSummary => {
      return createPlaylist(
        asString(name, 'name'),
        asNullableString(folderId ?? null),
        asNullableString(description ?? null)
      )
    }
  )

  handle('playlists:rename', (_event, playlistId: unknown, name: unknown): PlaylistSummary => {
    return renamePlaylist(asString(playlistId, 'playlist id'), asString(name, 'name'))
  })

  handle(
    'playlists:setDescription',
    (_event, playlistId: unknown, description: unknown): PlaylistSummary => {
      return setPlaylistDescription(asString(playlistId, 'playlist id'), asNullableString(description))
    }
  )

  handle(
    'playlists:chooseCover',
    async (event, playlistId: unknown): Promise<PlaylistSummary | null> => {
      const id = asString(playlistId, 'playlist id')
      const win = dialogParent(event)
      const options: Electron.OpenDialogOptions = {
        title: 'Choose playlist cover',
        properties: ['openFile'],
        filters: [
          {
            name: 'Images',
            extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']
          }
        ]
      }
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0) return null
      const filePath = result.filePaths[0]
      const data = readFileSync(filePath)
      return setPlaylistCoverFromBuffer(id, data, mimeFromPath(filePath))
    }
  )

  handle(
    'playlists:setCoverData',
    (_event, playlistId: unknown, data: unknown, mime: unknown): PlaylistSummary => {
      const id = asString(playlistId, 'playlist id')
      let bytes: Buffer
      if (data instanceof ArrayBuffer) {
        bytes = Buffer.from(data)
      } else if (ArrayBuffer.isView(data)) {
        bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
      } else if (data && typeof data === 'object' && ArrayBuffer.isView((data as { data?: unknown }).data)) {
        // Some Electron builds clone Uint8Array oddly — accept { type:'Buffer', data:number[] } too
        const view = (data as { data: ArrayLike<number> }).data
        bytes = Buffer.from(view as number[])
      } else if (Array.isArray(data)) {
        bytes = Buffer.from(data as number[])
      } else {
        throw new Error('Invalid image data')
      }
      if (!bytes.length) throw new Error('Empty image')
      const mimeType = typeof mime === 'string' && mime ? mime : 'image/jpeg'
      return setPlaylistCoverFromBuffer(id, bytes, mimeType)
    }
  )

  handle('playlists:clearCover', (_event, playlistId: unknown): PlaylistSummary => {
    return clearPlaylistCover(asString(playlistId, 'playlist id'))
  })

  handle(
    'playlists:setAccentColor',
    (_event, playlistId: unknown, accentColor: unknown): PlaylistSummary => {
      return setPlaylistAccentColor(
        asString(playlistId, 'playlist id'),
        asNullableString(accentColor)
      )
    }
  )

  handle(
    'playlists:move',
    (_event, playlistId: unknown, folderId: unknown): PlaylistSummary => {
      return movePlaylist(asString(playlistId, 'playlist id'), asNullableString(folderId))
    }
  )

  handle('playlists:delete', (_event, playlistId: unknown) => {
    return deletePlaylist(asString(playlistId, 'playlist id'))
  })

  handle(
    'playlists:createFolder',
    (_event, name: unknown, parentId?: unknown): PlaylistFolder => {
      return createPlaylistFolder(asString(name, 'name'), asNullableString(parentId ?? null))
    }
  )

  handle(
    'playlists:renameFolder',
    (_event, folderId: unknown, name: unknown): PlaylistFolder => {
      return renamePlaylistFolder(asString(folderId, 'folder id'), asString(name, 'name'))
    }
  )

  handle(
    'playlists:moveFolder',
    (_event, folderId: unknown, parentId: unknown): PlaylistFolder => {
      return movePlaylistFolder(asString(folderId, 'folder id'), asNullableString(parentId))
    }
  )

  handle(
    'playlists:placeTreeItem',
    (_event, item: unknown, parentId: unknown, index: unknown): PlaylistTreeNode[] => {
      if (
        !item ||
        typeof item !== 'object' ||
        ((item as PlaylistTreeItemRef).type !== 'folder' &&
          (item as PlaylistTreeItemRef).type !== 'playlist') ||
        typeof (item as PlaylistTreeItemRef).id !== 'string'
      ) {
        throw new Error('Invalid tree item')
      }
      if (typeof index !== 'number' || !Number.isFinite(index)) {
        throw new Error('Invalid index')
      }
      return placeTreeItem(
        { type: (item as PlaylistTreeItemRef).type, id: (item as PlaylistTreeItemRef).id },
        asNullableString(parentId),
        index
      )
    }
  )

  handle('playlists:deleteFolder', (_event, folderId: unknown) => {
    return deletePlaylistFolder(asString(folderId, 'folder id'))
  })

  handle(
    'playlists:addTracks',
    (_event, playlistId: unknown, trackIds: unknown) => {
      if (!Array.isArray(trackIds)) throw new Error('Invalid track ids')
      return addTracksToPlaylist(
        asString(playlistId, 'playlist id'),
        trackIds.map((id) => asString(id, 'track id'))
      )
    }
  )

  handle(
    'playlists:removeTrack',
    (_event, playlistId: unknown, trackId: unknown) => {
      return removeTrackFromPlaylist(asString(playlistId, 'playlist id'), asString(trackId, 'track id'))
    }
  )

  handle(
    'playlists:reorderTracks',
    (_event, playlistId: unknown, trackIds: unknown): PlaylistDetail => {
      if (!Array.isArray(trackIds)) throw new Error('Invalid track ids')
      return reorderPlaylistTracks(
        asString(playlistId, 'playlist id'),
        trackIds.map((id) => asString(id, 'track id'))
      )
    }
  )

  handle('playlists:getLikedTrackIds', (): string[] => getLikedTrackIds())

  handle('playlists:setLiked', (_event, trackId: unknown, liked: unknown) => {
    if (typeof liked !== 'boolean') throw new Error('Invalid liked flag')
    return setTrackLiked(asString(trackId, 'track id'), liked)
  })

  handle('playlists:getRating', (_event, trackId: unknown): number | null => {
    return getTrackRating(asString(trackId, 'track id'))
  })

  handle('playlists:setRating', (_event, trackId: unknown, rating: unknown) => {
    if (rating != null && typeof rating !== 'number') throw new Error('Invalid rating')
    return setTrackRating(asString(trackId, 'track id'), rating as number | null)
  })

  handle('playlists:getRatingsMap', (_event, trackIds: unknown): Record<string, number> => {
    if (!Array.isArray(trackIds)) throw new Error('Invalid track ids')
    return getRatingsMap(trackIds.map((id) => asString(id, 'track id')))
  })

  handle('playlists:getTags', (_event, trackId: unknown): string[] => {
    return getTrackTags(asString(trackId, 'track id'))
  })

  handle('playlists:setTags', (_event, trackId: unknown, tags: unknown): string[] => {
    if (!Array.isArray(tags)) throw new Error('Invalid tags')
    return setTrackTags(
      asString(trackId, 'track id'),
      tags.map((tag) => asString(tag, 'tag'))
    )
  })
}
