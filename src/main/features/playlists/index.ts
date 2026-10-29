/**
 * Playlists feature (main process)
 * Nested folders, playlist CRUD, favorites, ratings, tags.
 */
export {
  addTracksToPlaylist,
  createPlaylist,
  createPlaylistFolder,
  deletePlaylist,
  deletePlaylistFolder,
  ensureSystemPlaylists,
  getLikedPlaylistId,
  getLikedTrackIds,
  getPlaylistDetail,
  getPlaylistTracks,
  getPlaylistTree,
  getRatingsMap,
  getTrackRating,
  getTrackTags,
  listPlaylistFolders,
  listPlaylists,
  movePlaylist,
  movePlaylistFolder,
  placeTreeItem,
  removeTrackFromPlaylist,
  renamePlaylist,
  renamePlaylistFolder,
  reorderPlaylistTracks,
  clearPlaylistCover,
  setPlaylistAccentColor,
  setPlaylistCover,
  setPlaylistCoverFromBuffer,
  setPlaylistDescription,
  setTrackLiked,
  setTrackRating,
  setTrackTags
} from './service'
export { getPlaylistRecommendations } from './recommendations'
