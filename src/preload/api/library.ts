import { ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  AddFolderResult,
  AlbumRow,
  ArtistRow,
  ArtistSpotlight,
  HomePersonalization,
  LibraryFolder,
  LibrarySummary,
  LocalMix,
  RelatedTracksResult,
  ScanProgress,
  ScanResult,
  TrackQuery,
  TrackQueryResult,
  TrackRow
} from '../../shared/types'

export const libraryApi = {
  getSummary: (): Promise<LibrarySummary> => ipcRenderer.invoke('library:getSummary'),
  listFolders: (): Promise<LibraryFolder[]> => ipcRenderer.invoke('library:listFolders'),
  addFolder: (): Promise<AddFolderResult> => ipcRenderer.invoke('library:addFolder'),
  loadDemoLibrary: (): Promise<AddFolderResult> => ipcRenderer.invoke('library:loadDemoLibrary'),
  importFiles: (): Promise<ScanResult | null> => ipcRenderer.invoke('library:importFiles'),
  removeFolder: (folderId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('library:removeFolder', folderId),
  openFolder: (folderId: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke('library:openFolder', folderId),
  rescanAll: (): Promise<ScanResult[]> => ipcRenderer.invoke('library:rescanAll'),
  rescanFolder: (folderId: string): Promise<ScanResult> =>
    ipcRenderer.invoke('library:rescanFolder', folderId),
  setFolderWatchEnabled: (enabled: boolean): Promise<{ ok: true; enabled: boolean }> =>
    ipcRenderer.invoke('library:setFolderWatchEnabled', enabled),
  isFolderWatchEnabled: (): Promise<boolean> => ipcRenderer.invoke('library:isFolderWatchEnabled'),
  queryTracks: (options?: TrackQuery): Promise<TrackQueryResult> =>
    ipcRenderer.invoke('library:queryTracks', options ?? {}),
  listTracksByIds: (ids: string[]): Promise<TrackRow[]> =>
    ipcRenderer.invoke('library:listTracksByIds', ids),
  listAlbums: (query?: string): Promise<AlbumRow[]> =>
    ipcRenderer.invoke('library:listAlbums', query),
  listArtists: (query?: string): Promise<ArtistRow[]> =>
    ipcRenderer.invoke('library:listArtists', query),
  listGenres: (): Promise<Array<{ genre: string; trackCount: number }>> =>
    ipcRenderer.invoke('library:listGenres'),
  getRecentTracks: (limit?: number): Promise<TrackRow[]> =>
    ipcRenderer.invoke('library:getRecentTracks', limit),
  getRelatedTracks: (trackId: string, limit?: number): Promise<RelatedTracksResult> =>
    ipcRenderer.invoke('library:getRelatedTracks', trackId, limit),
  getArtistSpotlight: (artistId: string | null, artistName?: string): Promise<ArtistSpotlight> =>
    ipcRenderer.invoke('library:getArtistSpotlight', artistId, artistName),
  isScanning: (): Promise<boolean> => ipcRenderer.invoke('library:isScanning'),
  recordPlay: (trackId: string): Promise<{ ok: boolean; playCount: number }> =>
    ipcRenderer.invoke('library:recordPlay', trackId),
  getHomePersonalization: (): Promise<HomePersonalization> =>
    ipcRenderer.invoke('library:getHomePersonalization'),
  getDailyMixes: (forceRefresh?: boolean): Promise<LocalMix[]> =>
    ipcRenderer.invoke('library:getDailyMixes', forceRefresh === true),
  onScanProgress: (callback: (progress: ScanProgress) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, progress: ScanProgress): void => {
      callback(progress)
    }
    ipcRenderer.on('library:scanProgress', listener)
    return () => ipcRenderer.removeListener('library:scanProgress', listener)
  }
}
