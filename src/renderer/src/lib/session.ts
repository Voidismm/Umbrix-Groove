/** Small localStorage helpers for session restore across refresh / relaunch. */

export function readSession<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeSession(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota or private mode — ignore
  }
}

export function clearSession(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export const SESSION_KEYS = {
  playback: 'umbrix.session.playback',
  library: 'umbrix.session.library',
  shell: 'umbrix.session.shell',
  playlist: 'umbrix.session.playlist'
} as const
