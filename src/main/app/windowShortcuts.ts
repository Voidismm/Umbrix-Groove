import { app, BrowserWindow } from 'electron'

/**
 * F5 / Ctrl+R — reload the renderer (soft refresh).
 * Shift+F5 / Ctrl+Shift+R — relaunch the whole Electron process.
 */
export function registerWindowRefreshShortcut(window: BrowserWindow): void {
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return

    const isF5 = input.key === 'F5'
    const isCtrlR =
      (input.control || input.meta) &&
      !input.alt &&
      input.key.toLowerCase() === 'r'

    if (!isF5 && !isCtrlR) return

    event.preventDefault()

    if (input.shift) {
      app.relaunch()
      app.exit(0)
      return
    }

    window.webContents.reload()
  })
}
