import { ipcMain } from 'electron'
import { updateDiscordPresence } from '../features/discord'
import type { DiscordPresencePayload } from '../../shared/types/discord'

function isPayload(value: unknown): value is DiscordPresencePayload {
  if (!value || typeof value !== 'object') return false
  const v = value as DiscordPresencePayload
  return typeof v.playing === 'boolean'
}

/** Renderer → main Discord Rich Presence updates. */
export function registerDiscordIpc(): void {
  ipcMain.removeAllListeners('discord:setPresence')
  ipcMain.on('discord:setPresence', (_event, payload: unknown) => {
    if (!isPayload(payload)) return
    updateDiscordPresence({
      playing: payload.playing,
      title: typeof payload.title === 'string' ? payload.title : undefined,
      artist: typeof payload.artist === 'string' ? payload.artist : undefined,
      album: typeof payload.album === 'string' ? payload.album : undefined,
      positionMs: typeof payload.positionMs === 'number' ? payload.positionMs : undefined,
      durationMs: typeof payload.durationMs === 'number' ? payload.durationMs : undefined
    })
  })
}
