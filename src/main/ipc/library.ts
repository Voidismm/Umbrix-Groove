import { existsSync } from 'fs'
import { BrowserWindow, dialog, shell } from 'electron'
import { handle } from './handle'
import { AUDIO_EXTENSIONS } from '../../shared/constants'
import type {
  AddFolderResult,
  HomePersonalization,
  LibraryFolder,
  LibrarySummary,
  LocalMix,
  ScanProgress,
  ScanResult,
  TrackMetadataPatch,
  TrackQuery,
  TrackQueryResult,
  TrackRow
} from '../../shared/types'
import {
  addLibraryFolder,
  configureFolderWatch,
  ensureDemoLibrary,
  getArtistSpotlight,
  getDailyMixes,
  getHomePersonalization,
  getRecentTracks,
  getRelatedTracks,
  getSummary,
  getTrackLyricsOverride,
  importAudioFiles,
  isFolderWatchEnabled,
  listAlbums,
  listArtists,
  listFolders,
  listGenres,
  listTracksByIds,
  queryTracks,
  recordPlay,
  removeFolder,
  scanAllFolders,
  scanFolder,
  setFolderWatchEnabled,
  syncFolderWatchers,
  unwatchLibraryFolder,
  updateTrackMetadata,
  watchLibraryFolder
} from '../features/library'
import type { ArtistSpotlight, RelatedTracksResult } from '../../shared/types'

let scanning = false

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

function dialogParent(event: Electron.IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow() ?? undefined
}

async function indexFolder(folderPath: string): Promise<AddFolderResult> {
  const { id, created } = await addLibraryFolder(folderPath)
  await runScan(() =>
    scanFolder(id, (progress) => broadcast('library:scanProgress', progress))
  )
  const folder = listFolders().find((item) => item.id === id) ?? null
  if (folder) watchLibraryFolder(folder.id, folder.path)
  return {
    folder,
    cancelled: false,
    alreadyExists: !created
  }
}

async function watchedRescan(folderId: string): Promise<void> {
  await runScan(() =>
    scanFolder(folderId, (progress) => broadcast('library:scanProgress', progress))
  )
}

async function runScan<T>(work: () => Promise<T>): Promise<T> {
  if (scanning) {
    throw new Error('A scan is already running')
  }
  scanning = true
  try {
    return await work()
  } catch (error) {
    const progress: ScanProgress = {
      phase: 'error',
      folderPath: '',
      processed: 0,
      total: 0,
      added: 0,
      updated: 0,
      removed: 0,
      errors: 1,
      message: error instanceof Error ? error.message : String(error)
    }
    broadcast('library:scanProgress', progress)
    throw error
  } finally {
    scanning = false
  }
}

/** Library IPC: folders, scan, search, browse. */
export function registerLibraryIpc(): void {
  configureFolderWatch(async (folderId) => {
    await watchedRescan(folderId)
  })
  // Live index: watch every music folder (toggleable from Settings).
  setFolderWatchEnabled(true)
  syncFolderWatchers()

  handle('library:getSummary', (): LibrarySummary => getSummary())

  handle('library:listFolders', (): LibraryFolder[] => listFolders())

  handle('library:setFolderWatchEnabled', (_event, enabled: unknown) => {
    setFolderWatchEnabled(enabled !== false)
    return { ok: true as const, enabled: isFolderWatchEnabled() }
  })

  handle('library:isFolderWatchEnabled', () => isFolderWatchEnabled())

  handle('library:addFolder', async (event): Promise<AddFolderResult> => {
    const win = dialogParent(event)
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Add music folder',
          properties: ['openDirectory']
        })
      : await dialog.showOpenDialog({
          title: 'Add music folder',
          properties: ['openDirectory']
        })

    if (result.canceled || result.filePaths.length === 0) {
      return { folder: null, cancelled: true }
    }

    return indexFolder(result.filePaths[0])
  })

  handle('library:loadDemoLibrary', async (): Promise<AddFolderResult> => {
    const demoPath = ensureDemoLibrary()
    return indexFolder(demoPath)
  })

  handle('library:importFiles', async (event): Promise<ScanResult | null> => {
    const win = dialogParent(event)
    const options: Electron.OpenDialogOptions = {
      title: 'Import audio files',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Audio',
          extensions: [...AUDIO_EXTENSIONS]
        }
      ]
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return runScan(async () => importAudioFiles(result.filePaths))
  })

  handle('library:removeFolder', async (_event, folderId: string) => {
    if (typeof folderId !== 'string' || !folderId) {
      throw new Error('Invalid folder id')
    }
    unwatchLibraryFolder(folderId)
    const ok = removeFolder(folderId)
    return { ok }
  })

  handle('library:openFolder', async (_event, folderId: string) => {
    if (typeof folderId !== 'string' || !folderId) {
      throw new Error('Invalid folder id')
    }
    const folder = listFolders().find((item) => item.id === folderId)
    if (!folder) throw new Error('Folder not found')
    if (!existsSync(folder.path)) {
      throw new Error('That folder is missing on disk')
    }
    const err = await shell.openPath(folder.path)
    if (err) throw new Error(err)
    return { ok: true as const }
  })

  handle('library:rescanAll', async (): Promise<ScanResult[]> => {
    return runScan(() =>
      scanAllFolders((progress) => broadcast('library:scanProgress', progress))
    )
  })

  handle('library:rescanFolder', async (_event, folderId: string): Promise<ScanResult> => {
    if (typeof folderId !== 'string' || !folderId) {
      throw new Error('Invalid folder id')
    }
    return runScan(() =>
      scanFolder(folderId, (progress) => broadcast('library:scanProgress', progress))
    )
  })

  handle('library:queryTracks', (_event, options: TrackQuery): TrackQueryResult => {
    return queryTracks(options ?? {})
  })

  handle('library:listTracksByIds', (_event, ids: unknown): TrackRow[] => {
    if (!Array.isArray(ids)) return []
    const clean = ids
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .slice(0, 500)
    return listTracksByIds(clean).filter((track) => !track.missing)
  })

  handle('library:listAlbums', (_event, query?: string) => listAlbums(query))

  handle('library:listArtists', (_event, query?: string) => listArtists(query))

  handle('library:listGenres', () => listGenres())

  handle('library:getRecentTracks', (_event, limit?: number) =>
    getRecentTracks(typeof limit === 'number' ? limit : 24)
  )

  handle(
    'library:getRelatedTracks',
    (_event, trackId: unknown, limit?: unknown): RelatedTracksResult => {
      if (typeof trackId !== 'string' || !trackId) throw new Error('Invalid track id')
      return getRelatedTracks(trackId, typeof limit === 'number' ? limit : 8)
    }
  )

  handle(
    'library:getArtistSpotlight',
    (_event, artistId: unknown, artistName?: unknown): ArtistSpotlight => {
      return getArtistSpotlight(
        typeof artistId === 'string' && artistId ? artistId : null,
        typeof artistName === 'string' ? artistName : 'Unknown Artist'
      )
    }
  )

  handle('library:isScanning', () => scanning)

  handle('library:recordPlay', (_event, trackId: unknown) => {
    if (typeof trackId !== 'string' || !trackId) throw new Error('Invalid track id')
    return recordPlay(trackId)
  })

  handle('library:getHomePersonalization', (): HomePersonalization => getHomePersonalization())

  handle('library:getDailyMixes', (_event, forceRefresh?: unknown): LocalMix[] => {
    return getDailyMixes(forceRefresh === true)
  })

  handle('library:getTrackLyricsOverride', (_event, trackId: unknown): string | null => {
    if (typeof trackId !== 'string' || !trackId) throw new Error('Invalid track id')
    return getTrackLyricsOverride(trackId)
  })

  handle(
    'library:updateTrackMetadata',
    (_event, trackId: unknown, patch: unknown): TrackRow => {
      if (typeof trackId !== 'string' || !trackId) throw new Error('Invalid track id')
      if (!patch || typeof patch !== 'object') throw new Error('Invalid metadata patch')
      return updateTrackMetadata(trackId, patch as TrackMetadataPatch)
    }
  )
}
