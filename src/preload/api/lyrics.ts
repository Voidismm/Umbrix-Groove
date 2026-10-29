import { ipcRenderer } from 'electron'
import type { LyricsPayload } from '../../shared/types'

export type LyricsGetOptions = {
  preferSidecar?: boolean
}

export const lyricsApi = {
  getForTrack: (trackId: string, options?: LyricsGetOptions): Promise<LyricsPayload> =>
    ipcRenderer.invoke('lyrics:getForTrack', trackId, options)
}
