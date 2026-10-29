import { ipcRenderer } from 'electron'
import type { DiscordPresencePayload } from '../../shared/types/discord'

export const discordApi = {
  setPresence: (payload: DiscordPresencePayload): void => {
    ipcRenderer.send('discord:setPresence', payload)
  }
}
