import { watch, type FSWatcher } from 'fs'
import { basename, extname, join } from 'path'
import { isAudioFile } from './audioExtensions'
import { listFolders } from './queries'

type ScanFolderFn = (folderId: string) => Promise<unknown>

const DEBOUNCE_MS = 1800

const watchers = new Map<string, FSWatcher>()
const pendingFolderIds = new Set<string>()
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let enabled = true
let scanFolderFn: ScanFolderFn | null = null
let flushRunning = false

function isInterestingPath(relativeOrName: string | null): boolean {
  if (!relativeOrName) return true
  const name = basename(relativeOrName)
  if (!name || name.startsWith('.')) return false
  if (name.endsWith('~') || name.startsWith('~$')) return false
  // Directory events often have no extension — still interesting
  const ext = extname(name).toLowerCase()
  if (!ext) return true
  // Audio, or sidecar lyrics that pair with tracks
  if (isAudioFile(name) || ext === '.lrc' || ext === '.txt' || ext === '.lyrics') return true
  return false
}

function scheduleFlush(folderId: string): void {
  if (!enabled || !scanFolderFn) return
  pendingFolderIds.add(folderId)
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void flushPending()
  }, DEBOUNCE_MS)
}

async function flushPending(): Promise<void> {
  if (!enabled || !scanFolderFn || flushRunning) return
  if (pendingFolderIds.size === 0) return

  flushRunning = true
  const retry = new Set<string>()
  try {
    const ids = [...pendingFolderIds]
    pendingFolderIds.clear()
    for (const folderId of ids) {
      if (!enabled || !scanFolderFn) break
      try {
        await scanFolderFn(folderId)
      } catch (err) {
        // Busy scan or missing folder — retry after another debounce
        console.warn('[folderWatch] rescan deferred', folderId, err)
        retry.add(folderId)
      }
    }
  } finally {
    flushRunning = false
    for (const folderId of retry) pendingFolderIds.add(folderId)
    if (pendingFolderIds.size > 0 && enabled) {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        void flushPending()
      }, DEBOUNCE_MS)
    }
  }
}

function stopWatcher(folderId: string): void {
  const existing = watchers.get(folderId)
  if (!existing) return
  existing.close()
  watchers.delete(folderId)
}

function startWatcher(folderId: string, folderPath: string): void {
  stopWatcher(folderId)
  try {
    const watcher = watch(folderPath, { recursive: true }, (_event, filename) => {
      if (!enabled) return
      const rel = typeof filename === 'string' ? filename : null
      if (!isInterestingPath(rel)) return
      // Confirm path still under folder when we have a name
      if (rel) {
        void join(folderPath, rel)
      }
      scheduleFlush(folderId)
    })
    watcher.on('error', (err) => {
      console.warn('[folderWatch] watcher error', folderPath, err)
      stopWatcher(folderId)
    })
    watchers.set(folderId, watcher)
  } catch (err) {
    console.warn('[folderWatch] could not watch', folderPath, err)
  }
}

/** Wire the scan callback used after debounced filesystem events. */
export function configureFolderWatch(scanFolder: ScanFolderFn): void {
  scanFolderFn = scanFolder
}

export function setFolderWatchEnabled(next: boolean): void {
  enabled = next
  if (!enabled) {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    pendingFolderIds.clear()
    stopAllFolderWatchers()
    return
  }
  syncFolderWatchers()
}

export function isFolderWatchEnabled(): boolean {
  return enabled
}

/** Start / refresh watchers for every library folder currently in the DB. */
export function syncFolderWatchers(): void {
  if (!enabled) {
    stopAllFolderWatchers()
    return
  }
  const folders = listFolders()
  const liveIds = new Set(folders.map((folder) => folder.id))

  for (const folderId of watchers.keys()) {
    if (!liveIds.has(folderId)) stopWatcher(folderId)
  }

  for (const folder of folders) {
    const current = watchers.get(folder.id)
    if (current) continue
    startWatcher(folder.id, folder.path)
  }
}

export function watchLibraryFolder(folderId: string, folderPath: string): void {
  if (!enabled) return
  startWatcher(folderId, folderPath)
}

export function unwatchLibraryFolder(folderId: string): void {
  stopWatcher(folderId)
  pendingFolderIds.delete(folderId)
}

export function stopAllFolderWatchers(): void {
  for (const folderId of [...watchers.keys()]) {
    stopWatcher(folderId)
  }
}
