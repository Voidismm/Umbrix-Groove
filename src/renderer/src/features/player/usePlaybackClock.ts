import { useSyncExternalStore } from 'react'
import { getPlaybackClockSnapshot, subscribePlaybackClock } from './playbackClock'

/** Subscribe to playback elapsed time without re-rendering PlaybackContext consumers. */
export function usePlaybackClock(): number {
  return useSyncExternalStore(subscribePlaybackClock, getPlaybackClockSnapshot, getPlaybackClockSnapshot)
}
