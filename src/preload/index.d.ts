import type {
  AddFolderResult,
  AlbumRow,
  ArtistRow,
  ArtistSpotlight,
  DiscordPresencePayload,
  HomePersonalization,
  LibraryFolder,
  LibrarySummary,
  LocalMix,
  LyricsPayload,
  PlaylistDetail,
  PlaylistFolder,
  PlaylistSummary,
  PlaylistTreeNode,
  RelatedTracksResult,
  ScanProgress,
  ScanResult,
  TrackQuery,
  TrackQueryResult,
  TrackRow
} from '../shared/types'

export interface UmbrixLibraryApi {
  getSummary: () => Promise<LibrarySummary>
  listFolders: () => Promise<LibraryFolder[]>
  addFolder: () => Promise<AddFolderResult>
  loadDemoLibrary: () => Promise<AddFolderResult>
  importFiles: () => Promise<ScanResult | null>
  removeFolder: (folderId: string) => Promise<{ ok: boolean }>
  openFolder: (folderId: string) => Promise<{ ok: true }>
  rescanAll: () => Promise<ScanResult[]>
  rescanFolder: (folderId: string) => Promise<ScanResult>
  setFolderWatchEnabled: (enabled: boolean) => Promise<{ ok: true; enabled: boolean }>
  isFolderWatchEnabled: () => Promise<boolean>
  queryTracks: (options?: TrackQuery) => Promise<TrackQueryResult>
  listTracksByIds: (ids: string[]) => Promise<TrackRow[]>
  listAlbums: (query?: string) => Promise<AlbumRow[]>
  listArtists: (query?: string) => Promise<ArtistRow[]>
  listGenres: () => Promise<Array<{ genre: string; trackCount: number }>>
  getRecentTracks: (limit?: number) => Promise<TrackRow[]>
  getRelatedTracks: (trackId: string, limit?: number) => Promise<RelatedTracksResult>
  getArtistSpotlight: (artistId: string | null, artistName?: string) => Promise<ArtistSpotlight>
  isScanning: () => Promise<boolean>
  recordPlay: (trackId: string) => Promise<{ ok: boolean; playCount: number }>
  getHomePersonalization: () => Promise<HomePersonalization>
  getDailyMixes: (forceRefresh?: boolean) => Promise<LocalMix[]>
  onScanProgress: (callback: (progress: ScanProgress) => void) => () => void
}

export interface UmbrixPlaylistsApi {
  getTree: () => Promise<PlaylistTreeNode[]>
  list: () => Promise<PlaylistSummary[]>
  get: (playlistId: string) => Promise<PlaylistDetail>
  getTracks: (playlistId: string) => Promise<TrackRow[]>
  getRecommendations: (
    playlistId: string,
    limit?: number,
    options?: { excludeIds?: string[]; salt?: number }
  ) => Promise<TrackRow[]>
  create: (
    name: string,
    folderId?: string | null,
    description?: string | null
  ) => Promise<PlaylistSummary>
  rename: (playlistId: string, name: string) => Promise<PlaylistSummary>
  setDescription: (playlistId: string, description: string | null) => Promise<PlaylistSummary>
  chooseCover: (playlistId: string) => Promise<PlaylistSummary | null>
  setCoverData: (playlistId: string, data: ArrayBuffer, mime: string) => Promise<PlaylistSummary>
  clearCover: (playlistId: string) => Promise<PlaylistSummary>
  setAccentColor: (playlistId: string, accentColor: string | null) => Promise<PlaylistSummary>
  move: (playlistId: string, folderId: string | null) => Promise<PlaylistSummary>
  delete: (playlistId: string) => Promise<{ ok: boolean }>
  createFolder: (name: string, parentId?: string | null) => Promise<PlaylistFolder>
  renameFolder: (folderId: string, name: string) => Promise<PlaylistFolder>
  moveFolder: (folderId: string, parentId: string | null) => Promise<PlaylistFolder>
  placeTreeItem: (
    item: import('../../shared/types').PlaylistTreeItemRef,
    parentId: string | null,
    index: number
  ) => Promise<PlaylistTreeNode[]>
  deleteFolder: (folderId: string) => Promise<{ ok: boolean }>
  addTracks: (
    playlistId: string,
    trackIds: string[]
  ) => Promise<{ added: number; playlist: PlaylistSummary }>
  removeTrack: (
    playlistId: string,
    trackId: string
  ) => Promise<{ ok: boolean; playlist: PlaylistSummary }>
  reorderTracks: (playlistId: string, trackIds: string[]) => Promise<PlaylistDetail>
  getLikedTrackIds: () => Promise<string[]>
  setLiked: (trackId: string, liked: boolean) => Promise<{ liked: boolean }>
  getRating: (trackId: string) => Promise<number | null>
  setRating: (trackId: string, rating: number | null) => Promise<{ rating: number | null }>
  getRatingsMap: (trackIds: string[]) => Promise<Record<string, number>>
  getTags: (trackId: string) => Promise<string[]>
  setTags: (trackId: string, tags: string[]) => Promise<string[]>
}

export interface UmbrixLyricsApi {
  getForTrack: (
    trackId: string,
    options?: { preferSidecar?: boolean }
  ) => Promise<LyricsPayload>
}

export interface UmbrixDiscordApi {
  setPresence: (payload: DiscordPresencePayload) => void
}

export type MediaCommand = 'toggle' | 'next' | 'previous'

export interface UmbrixPlaybackApi {
  onMediaCommand: (callback: (command: MediaCommand) => void) => () => void
}

export type UpdateCheckResult = {
  ok: boolean
  status: 'dev' | 'checking' | 'available' | 'up-to-date' | 'error'
  message: string
  version?: string
}

export interface UmbrixAppApi {
  getVersion: () => Promise<string>
  checkForUpdates: () => Promise<UpdateCheckResult>
}

export interface UmbrixApi {
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    onMaximizedChange: (callback: (maximized: boolean) => void) => () => void
  }
  library: UmbrixLibraryApi
  playlists: UmbrixPlaylistsApi
  lyrics: UmbrixLyricsApi
  discord: UmbrixDiscordApi
  playback: UmbrixPlaybackApi
  app: UmbrixAppApi
}

declare global {
  interface Window {
    api: UmbrixApi
  }
}

export {}
