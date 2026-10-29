/** MIME + helpers for dragging library / playlist tracks onto playlist tree rows. */

export const TRACK_DRAG_MIME = 'application/x-umbrix-track'

export function setTrackDragData(dataTransfer: DataTransfer, trackId: string): void {
  dataTransfer.setData(TRACK_DRAG_MIME, trackId)
  dataTransfer.setData('text/plain', trackId)
}

export function hasTrackDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(TRACK_DRAG_MIME)
}

export function readTrackDragId(dataTransfer: DataTransfer): string | null {
  const id = dataTransfer.getData(TRACK_DRAG_MIME) || dataTransfer.getData('text/plain')
  return id.trim() ? id.trim() : null
}
