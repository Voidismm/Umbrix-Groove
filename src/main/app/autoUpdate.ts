import { app, dialog, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

let checking = false
let promptOpen = false

async function askInstall(version: string): Promise<boolean> {
  if (promptOpen) return false
  promptOpen = true
  try {
    const result = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Install', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Umbrix Groove',
      message: 'Umbrix Groove has a new update. Install?',
      detail: `Version ${version} is ready to download.`
    })
    return result.response === 0
  } finally {
    promptOpen = false
  }
}

async function askRestart(): Promise<boolean> {
  const result = await dialog.showMessageBox({
    type: 'info',
    buttons: ['Restart now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'Umbrix Groove',
    message: 'Update downloaded.',
    detail: 'Restart Umbrix Groove to finish installing.'
  })
  return result.response === 0
}

/**
 * Packaged builds only — checks GitHub Releases and prompts to install.
 * Dev / unpackaged runs skip quietly.
 */
export function setupAutoUpdater(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    void (async () => {
      const ok = await askInstall(info.version)
      if (!ok) return
      try {
        await autoUpdater.downloadUpdate()
      } catch (err) {
        console.error('[updater] download failed', err)
        await dialog.showMessageBox({
          type: 'error',
          title: 'Umbrix Groove',
          message: 'Could not download the update.',
          detail: err instanceof Error ? err.message : String(err)
        })
      }
    })()
  })

  autoUpdater.on('update-downloaded', () => {
    void (async () => {
      const ok = await askRestart()
      if (ok) autoUpdater.quitAndInstall(false, true)
    })()
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err)
  })

  // Give the window a moment to show before the dialog.
  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((err) => {
      console.error('[updater] check failed', err)
    })
  }, 5000)
}

export type UpdateCheckResult = {
  ok: boolean
  status: 'dev' | 'checking' | 'available' | 'up-to-date' | 'error'
  message: string
  version?: string
}

/** Manual check from Settings — still uses the same Install? prompt when a build exists. */
export async function checkForUpdatesNow(): Promise<UpdateCheckResult> {
  if (!app.isPackaged) {
    return {
      ok: false,
      status: 'dev',
      message: 'Updates only work in the installed app, not while developing.'
    }
  }
  if (checking) {
    return { ok: true, status: 'checking', message: 'Already checking for updates…' }
  }

  checking = true
  try {
    const result = await autoUpdater.checkForUpdates()
    const remote = result?.updateInfo?.version
    const local = app.getVersion()
    if (!remote || remote === local) {
      return {
        ok: true,
        status: 'up-to-date',
        message: `You are on the latest version (${local}).`,
        version: local
      }
    }
    return {
      ok: true,
      status: 'available',
      message: `Version ${remote} is available.`,
      version: remote
    }
  } catch (err) {
    return {
      ok: false,
      status: 'error',
      message: err instanceof Error ? err.message : String(err)
    }
  } finally {
    checking = false
  }
}

export function registerUpdateIpc(): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:checkForUpdates', () => checkForUpdatesNow())
}
