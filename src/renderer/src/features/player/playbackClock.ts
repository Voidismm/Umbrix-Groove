/**
 * Playback progress clock — external store so ~20 Hz time updates do not
 * invalidate the main PlaybackContext (tables, sidebars, tree, etc.).
 *
 * Single writer: PlaybackProvider (rAF / seek / load). Consumers use
 * usePlaybackClock() via useSyncExternalStore.
 */

type Listener = () => void

const CLOCK_EPSILON = 0.05

let clockSeconds = 0
const listeners = new Set<Listener>()

export function getPlaybackClockSnapshot(): number {
  return clockSeconds
}

export function subscribePlaybackClock(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Publish elapsed seconds. Throttles notifications to ~CLOCK_EPSILON changes. */
export function setPlaybackClock(time: number, options?: { force?: boolean }): void {
  const next = Number.isFinite(time) && time >= 0 ? time : 0
  if (!options?.force && Math.abs(next - clockSeconds) < CLOCK_EPSILON) return
  clockSeconds = next
  for (const listener of listeners) listener()
}

export function resetPlaybackClock(): void {
  setPlaybackClock(0, { force: true })
}
