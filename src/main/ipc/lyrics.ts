import type { LyricsPayload } from '../../shared/types'
import { getLyricsForTrack, type LyricsLookupOptions } from '../features/lyrics'
import { handle } from './handle'

function parseOptions(raw: unknown): LyricsLookupOptions | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const preferSidecar = (raw as { preferSidecar?: unknown }).preferSidecar
  if (typeof preferSidecar !== 'boolean') return undefined
  return { preferSidecar }
}

/** Lyrics IPC — local sidecars and embedded tags only. */
export function registerLyricsIpc(): void {
  handle(
    'lyrics:getForTrack',
    async (_event, trackId: unknown, options?: unknown): Promise<LyricsPayload> => {
      if (typeof trackId !== 'string' || !trackId) {
        throw new Error('Invalid track id')
      }
      return getLyricsForTrack(trackId, parseOptions(options))
    }
  )
}
