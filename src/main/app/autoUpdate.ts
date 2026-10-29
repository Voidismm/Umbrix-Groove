import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

let checking = false
let awaitingDecision = false
let pendingDecision: ((accepted: boolean) => void) | null = null
let lastVersion: string | undefined

const UPDATE_FAILED_MESSAGE =
  'Update failed.\n\nPlease try again in a few minutes.'

export type UpdateEvent =
  | { type: 'available'; version: string }
  | { type: 'progress'; percent: number }
  | { type: 'ready'; version?: string }
  | { type: 'error'; message: string }

function sendUpdateEvent(event: UpdateEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('app:update-event', event)
  }
}

function waitForDecision(): Promise<boolean> {
  if (awaitingDecision) return Promise.resolve(false)
  awaitingDecision = true
  return new Promise((resolve) => {
    pendingDecision = (accepted) => {
      pendingDecision = null
      awaitingDecision = false
      resolve(accepted)
    }
  })
}

function resolveDecision(accepted: boolean): void {
  pendingDecision?.(accepted)
}

/**
 * Packaged builds only — checks GitHub Releases and prompts in the renderer UI.
 */
export function setupAutoUpdater(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    void (async () => {
      lastVersion = info.version
      sendUpdateEvent({ type: 'available', version: info.version })
      const ok = await waitForDecision()
      if (!ok) return
      try {
        await autoUpdater.downloadUpdate()
      } catch (err) {
        console.error('[updater] download failed', err)
        sendUpdateEvent({ type: 'error', message: UPDATE_FAILED_MESSAGE })
      }
    })()
  })

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateEvent({ type: 'progress', percent: progress.percent ?? 0 })
  })

  autoUpdater.on('update-downloaded', () => {
    void (async () => {
      sendUpdateEvent({ type: 'ready', version: lastVersion })
      const ok = await waitForDecision()
      if (ok) autoUpdater.quitAndInstall(false, true)
    })()
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err)
    sendUpdateEvent({ type: 'error', message: UPDATE_FAILED_MESSAGE })
  })

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

/** Manual check from Settings — same in-app prompt when a build exists. */
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
    console.error('[updater] check failed', err)
    return {
      ok: false,
      status: 'error',
      message: UPDATE_FAILED_MESSAGE
    }
  } finally {
    checking = false
  }
}

export function registerUpdateIpc(): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:checkForUpdates', () => checkForUpdatesNow())
  ipcMain.on('app:update-decision', (_event, accepted: unknown) => {
    resolveDecision(accepted === true)
  })
}
