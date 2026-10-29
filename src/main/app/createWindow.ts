import { BrowserWindow, nativeImage, shell } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { bindWindowMaximizeEvents } from '../ipc/window'
import { registerWindowRefreshShortcut } from './windowShortcuts'

function resolveAppIcon(): Electron.NativeImage | undefined {
  const candidates = [
    join(__dirname, '../../resources/icon.png'),
    join(process.resourcesPath, 'icon.png'),
    join(process.resourcesPath, 'app.asar.unpacked/resources/icon.png')
  ]
  for (const path of candidates) {
    if (!existsSync(path)) continue
    const image = nativeImage.createFromPath(path)
    if (!image.isEmpty()) return image
  }
  return undefined
}

/** Create the main Umbrix Groove window. */
export function createWindow(): BrowserWindow {
  const icon = resolveAppIcon()
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a070f',
    autoHideMenuBar: true,
    title: 'Umbrix Groove',
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  registerWindowRefreshShortcut(mainWindow)
  bindWindowMaximizeEvents(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
