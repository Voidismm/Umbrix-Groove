/**
 * Library feature (main process)
 * Scanning, metadata, artwork cache, and SQLite queries for local music.
 */
export { registerArtworkProtocol } from './artworkProtocol'
export { ensureDemoLibrary } from './demoLibrary'
export {
  configureFolderWatch,
  isFolderWatchEnabled,
  setFolderWatchEnabled,
  stopAllFolderWatchers,
  syncFolderWatchers,
  unwatchLibraryFolder,
  watchLibraryFolder
} from './folderWatch'
export {
  addLibraryFolder,
  importAudioFiles,
  scanAllFolders,
  scanFolder
} from './scanner'
export {
  cleanupOrphans,
  findFolderByPath,
  getRecentTracks,
  getSummary,
  getTrackMediaById,
  listAlbums,
  listArtists,
  listFolders,
  listGenres,
  listTracksByIds,
  queryTracks,
  removeFolder
} from './queries'
export { getArtistSpotlight, getRelatedTracks } from './related'
export {
  getDailyMixes,
  getHomePersonalization,
  getJumpBackIn,
  getMostPlayed,
  getOnRepeat,
  recordPlay
} from './listening'
