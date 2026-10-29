import { ipcMain } from 'electron'

/**
 * Register an invoke handler, replacing any prior one.
 * Needed so electron-vite main reloads do not leave stale / missing channels.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handle(channel: string, listener: (...args: any[]) => any): void {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, listener)
}
