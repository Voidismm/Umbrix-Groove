import { ipcRenderer, type IpcRendererEvent } from 'electron'

export type MediaCommand = 'toggle' | 'next' | 'previous'

export const playbackApi = {
  onMediaCommand: (callback: (command: MediaCommand) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, command: MediaCommand): void => {
      if (command === 'toggle' || command === 'next' || command === 'previous') {
        callback(command)
      }
    }
    ipcRenderer.on('playback:media', listener)
    return () => ipcRenderer.removeListener('playback:media', listener)
  }
}
