import { ipcRenderer, type IpcRendererEvent } from 'electron'

export type UpdateCheckResult = {
  ok: boolean
  status: 'dev' | 'checking' | 'available' | 'up-to-date' | 'error'
  message: string
  version?: string
}

export type UpdateEvent =
  | { type: 'available'; version: string }
  | { type: 'progress'; percent: number }
  | { type: 'ready'; version?: string }
  | { type: 'error'; message: string }

export const appApi = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  checkForUpdates: (): Promise<UpdateCheckResult> => ipcRenderer.invoke('app:checkForUpdates'),
  respondToUpdate: (accepted: boolean): void => {
    ipcRenderer.send('app:update-decision', accepted)
  },
  onUpdateEvent: (callback: (event: UpdateEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: UpdateEvent): void => {
      callback(payload)
    }
    ipcRenderer.on('app:update-event', listener)
    return () => {
      ipcRenderer.removeListener('app:update-event', listener)
    }
  }
}
