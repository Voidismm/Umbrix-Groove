import { ipcRenderer } from 'electron'

export type UpdateCheckResult = {
  ok: boolean
  status: 'dev' | 'checking' | 'available' | 'up-to-date' | 'error'
  message: string
  version?: string
}

export const appApi = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  checkForUpdates: (): Promise<UpdateCheckResult> => ipcRenderer.invoke('app:checkForUpdates')
}
