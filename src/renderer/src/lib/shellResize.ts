/** Marks the shell as mid-pane-drag so expensive listeners can skip work. */

export const SHELL_RESIZE_END_EVENT = 'ug:shell-resize-end'

export function setShellResizing(active: boolean): void {
  const root = document.documentElement
  if (active) {
    root.dataset.shellResizing = '1'
    return
  }
  delete root.dataset.shellResizing
  window.dispatchEvent(new Event(SHELL_RESIZE_END_EVENT))
}

export function isShellResizing(): boolean {
  return document.documentElement.dataset.shellResizing === '1'
}
