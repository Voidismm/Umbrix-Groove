import { ipcRenderer } from 'electron'
import type {
  PlaylistDetail,
  PlaylistFolder,
  PlaylistSummary,
  PlaylistTreeItemRef,
  PlaylistTreeNode,
  TrackRow
} from '../../shared/types'

export const playlistsApi = {
  getTree: (): Promise<PlaylistTreeNode[]> => ipcRenderer.invoke('playlists:getTree'),
  list: (): Promise<PlaylistSummary[]> => ipcRenderer.invoke('playlists:list'),
  get: (playlistId: string): Promise<PlaylistDetail> =>
    ipcRenderer.invoke('playlists:get', playlistId),
  getTracks: (playlistId: string): Promise<TrackRow[]> =>
    ipcRenderer.invoke('playlists:getTracks', playlistId),
  getRecommendations: (
    playlistId: string,
    limit?: number,
    options?: { excludeIds?: string[]; salt?: number }
  ): Promise<TrackRow[]> =>
    ipcRenderer.invoke('playlists:getRecommendations', playlistId, limit, options ?? {}),
  create: (name: string, folderId?: string | null, description?: string | null): Promise<PlaylistSummary> =>
    ipcRenderer.invoke('playlists:create', name, folderId ?? null, description ?? null),
  rename: (playlistId: string, name: string): Promise<PlaylistSummary> =>
    ipcRenderer.invoke('playlists:rename', playlistId, name),
  setDescription: (playlistId: string, description: string | null): Promise<PlaylistSummary> =>
    ipcRenderer.invoke('playlists:setDescription', playlistId, description),
  chooseCover: (playlistId: string): Promise<PlaylistSummary | null> =>
    ipcRenderer.invoke('playlists:chooseCover', playlistId),
  setCoverData: (
    playlistId: string,
    data: ArrayBuffer,
    mime: string
  ): Promise<PlaylistSummary> => ipcRenderer.invoke('playlists:setCoverData', playlistId, data, mime),
  clearCover: (playlistId: string): Promise<PlaylistSummary> =>
    ipcRenderer.invoke('playlists:clearCover', playlistId),
  setAccentColor: (playlistId: string, accentColor: string | null): Promise<PlaylistSummary> =>
    ipcRenderer.invoke('playlists:setAccentColor', playlistId, accentColor),
  move: (playlistId: string, folderId: string | null): Promise<PlaylistSummary> =>
    ipcRenderer.invoke('playlists:move', playlistId, folderId),
  delete: (playlistId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('playlists:delete', playlistId),
  createFolder: (name: string, parentId?: string | null): Promise<PlaylistFolder> =>
    ipcRenderer.invoke('playlists:createFolder', name, parentId ?? null),
  renameFolder: (folderId: string, name: string): Promise<PlaylistFolder> =>
    ipcRenderer.invoke('playlists:renameFolder', folderId, name),
  moveFolder: (folderId: string, parentId: string | null): Promise<PlaylistFolder> =>
    ipcRenderer.invoke('playlists:moveFolder', folderId, parentId),
  placeTreeItem: (
    item: PlaylistTreeItemRef,
    parentId: string | null,
    index: number
  ): Promise<PlaylistTreeNode[]> =>
    ipcRenderer.invoke('playlists:placeTreeItem', item, parentId, index),
  deleteFolder: (folderId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('playlists:deleteFolder', folderId),
  addTracks: (
    playlistId: string,
    trackIds: string[]
  ): Promise<{ added: number; playlist: PlaylistSummary }> =>
    ipcRenderer.invoke('playlists:addTracks', playlistId, trackIds),
  removeTrack: (
    playlistId: string,
    trackId: string
  ): Promise<{ ok: boolean; playlist: PlaylistSummary }> =>
    ipcRenderer.invoke('playlists:removeTrack', playlistId, trackId),
  reorderTracks: (playlistId: string, trackIds: string[]): Promise<PlaylistDetail> =>
    ipcRenderer.invoke('playlists:reorderTracks', playlistId, trackIds),
  getLikedTrackIds: (): Promise<string[]> => ipcRenderer.invoke('playlists:getLikedTrackIds'),
  setLiked: (trackId: string, liked: boolean): Promise<{ liked: boolean }> =>
    ipcRenderer.invoke('playlists:setLiked', trackId, liked),
  getRating: (trackId: string): Promise<number | null> =>
    ipcRenderer.invoke('playlists:getRating', trackId),
  setRating: (trackId: string, rating: number | null): Promise<{ rating: number | null }> =>
    ipcRenderer.invoke('playlists:setRating', trackId, rating),
  getRatingsMap: (trackIds: string[]): Promise<Record<string, number>> =>
    ipcRenderer.invoke('playlists:getRatingsMap', trackIds),
  getTags: (trackId: string): Promise<string[]> => ipcRenderer.invoke('playlists:getTags', trackId),
  setTags: (trackId: string, tags: string[]): Promise<string[]> =>
    ipcRenderer.invoke('playlists:setTags', trackId, tags)
}
