import { BrowserWindow, globalShortcut } from 'electron'

export type MediaCommand = 'toggle' | 'next' | 'previous'

const ACCELS: { accel: string; command: MediaCommand }[] = [
  { accel: 'MediaPlayPause', command: 'toggle' },
  { accel: 'MediaNextTrack', command: 'next' },
  { accel: 'MediaPreviousTrack', command: 'previous' }
]

function broadcast(command: MediaCommand): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('playback:media', command)
    }
  }
}

/** Hardware / keyboard media keys → renderer playback (works while Groove is in the background). */
export function registerMediaKeys(): void {
  for (const { accel, command } of ACCELS) {
    try {
      const ok = globalShortcut.register(accel, () => broadcast(command))
      if (!ok) {
        console.warn(`[mediaKeys] could not register ${accel}`)
      }
    } catch (err) {
      console.warn(`[mediaKeys] failed to register ${accel}`, err)
    }
  }
}

export function unregisterMediaKeys(): void {
  for (const { accel } of ACCELS) {
    try {
      globalShortcut.unregister(accel)
    } catch {
      /* ignore */
    }
  }
}
