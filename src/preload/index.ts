/**
 * Preload bridge — exposes a narrow, typed API to the renderer.
 * No filesystem or database access here.
 *
 * Do not require npm packages here: sandboxed preload can only load Electron APIs.
 */
import { contextBridge } from 'electron'
import { appApi } from './api/app'
import { discordApi } from './api/discord'
import { libraryApi } from './api/library'
import { lyricsApi } from './api/lyrics'
import { playbackApi } from './api/playback'
import { playlistsApi } from './api/playlists'
import { windowApi } from './api/window'

const api = {
  window: windowApi,
  library: libraryApi,
  playlists: playlistsApi,
  lyrics: lyricsApi,
  discord: discordApi,
  playback: playbackApi,
  app: appApi
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-expect-error fallback when isolation is disabled
  window.api = api
}
