/**
 * Electron main-process entry.
 * Keep this file thin — bootstrap only.
 */
import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { setupAutoUpdater } from './app/autoUpdate'
import { createWindow } from './app/createWindow'
import { registerMediaKeys, unregisterMediaKeys } from './app/mediaKeys'
import { registerPrivilegedSchemes } from './app/registerSchemes'
import { closeDatabase, initDatabase } from './db/database'
import { startDiscordPresence, stopDiscordPresence } from './features/discord'
import { registerArtworkProtocol, stopAllFolderWatchers } from './features/library'
import { registerAllIpc } from './ipc'

registerPrivilegedSchemes()

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.umbrix.groove')

  initDatabase()
  registerArtworkProtocol()
  registerAllIpc()
  startDiscordPresence()
  registerMediaKeys()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  unregisterMediaKeys()
})

app.on('before-quit', () => {
  stopAllFolderWatchers()
  void stopDiscordPresence()
  closeDatabase()
})
