import { registerUpdateIpc } from '../app/autoUpdate'
import { registerDiscordIpc } from './discord'
import { registerLibraryIpc } from './library'
import { registerLyricsIpc } from './lyrics'
import { registerPlaylistIpc } from './playlists'
import { registerWindowIpc } from './window'

/** Register every main-process IPC channel. */
export function registerAllIpc(): void {
  registerWindowIpc()
  registerLibraryIpc()
  registerPlaylistIpc()
  registerLyricsIpc()
  registerDiscordIpc()
  registerUpdateIpc()
}
