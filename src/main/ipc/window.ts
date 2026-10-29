import { BrowserWindow, ipcMain } from 'electron'
import { handle } from './handle'

function winFrom(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

/** Window chrome controls (minimize / maximize / close) + maximize state. */
export function registerWindowIpc(): void {
  ipcMain.on('window:minimize', (event) => {
    winFrom(event)?.minimize()
  })

  ipcMain.on('window:maximize', (event) => {
    const win = winFrom(event)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.on('window:close', (event) => {
    winFrom(event)?.close()
  })

  handle('window:isMaximized', (event) => {
    return winFrom(event)?.isMaximized() ?? false
  })
}

/** Push maximize / restore changes to the renderer for drag-region CSS. */
export function bindWindowMaximizeEvents(window: BrowserWindow): void {
  const send = (maximized: boolean): void => {
    if (!window.isDestroyed()) {
      window.webContents.send('window:maximized', maximized)
    }
  }
  window.on('maximize', () => send(true))
  window.on('unmaximize', () => send(false))
}
