import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { PlaylistSummary, TrackRow } from '@shared/types'
import { Icon } from '@renderer/components/ui/Icon'
import { AddToPlaylistPicker } from './AddToPlaylistPicker'
import './TrackContextMenu.css'

export type TrackContextMenuProps = {
  x: number
  y: number
  track: TrackRow
  liked: boolean
  playlists: PlaylistSummary[]
  /** When set, show Remove from playlist for that playlist. */
  playlistId?: string
  onClose: () => void
  onAddToPlaylist: (playlistId: string) => void
  onNewPlaylist: () => void
  onToggleLoved: () => void
  onPlayNext: () => void
  onAddToQueue: () => void
  onEditMetadata?: () => void
  onRemoveFromPlaylist?: () => void
}

/** Track row / now-playing actions: playlist flyout, loved, queue, optional remove. */
export function TrackContextMenu({
  x,
  y,
  track,
  liked,
  playlists,
  playlistId,
  onClose,
  onAddToPlaylist,
  onNewPlaylist,
  onToggleLoved,
  onPlayNext,
  onAddToQueue,
  onEditMetadata,
  onRemoveFromPlaylist
}: TrackContextMenuProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const [submenuLeft, setSubmenuLeft] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const pad = 8
    const rect = el.getBoundingClientRect()
    let left = x
    let top = y - rect.height
    if (top < pad) top = Math.min(y, window.innerHeight - rect.height - pad)
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad)
    }
    if (left < pad) left = pad
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad)
    }
    el.style.left = `${left}px`
    el.style.top = `${top}px`

    const submenuWidth = 268
    setSubmenuLeft(left + rect.width + submenuWidth > window.innerWidth - pad)
  }, [x, y, submenuOpen, track.id])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    const onPointer = (event: MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="track-ctx"
      role="menu"
      aria-label={`Actions for ${track.title}`}
      style={{ left: x, top: y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="track-ctx__item-wrap">
        <button
          type="button"
          role="menuitem"
          className={`track-ctx__item${submenuOpen ? ' is-open' : ''}`}
          aria-haspopup="menu"
          aria-expanded={submenuOpen}
          onClick={() => setSubmenuOpen((open) => !open)}
        >
          <Icon name="add-to-playlist" size={16} />
          <span>Add to playlist</span>
          <span className="track-ctx__caret" aria-hidden>
            ›
          </span>
        </button>

        {submenuOpen ? (
          <div
            className={`track-ctx__submenu${submenuLeft ? ' is-left' : ''}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <AddToPlaylistPicker
              playlists={playlists}
              onSelectPlaylist={(id) => {
                onAddToPlaylist(id)
                onClose()
              }}
              onNewPlaylist={() => {
                onNewPlaylist()
                onClose()
              }}
              onClose={onClose}
            />
          </div>
        ) : null}
      </div>

      <button
        type="button"
        role="menuitem"
        className="track-ctx__item"
        onClick={() => {
          onToggleLoved()
          onClose()
        }}
      >
        <span
          className={`ug-candy-heart ug-candy-heart--mark${liked ? ' is-liked' : ''}`}
          style={{ '--ug-candy-heart-size': '16px' } as CSSProperties}
          aria-hidden
        />
        <span>{liked ? 'Remove from loved songs' : 'Add to loved songs'}</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className="track-ctx__item"
        onClick={() => {
          onPlayNext()
          onClose()
        }}
      >
        <Icon name="next" size={16} />
        <span>Play next</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className="track-ctx__item"
        onClick={() => {
          onAddToQueue()
          onClose()
        }}
      >
        <Icon name="queue" size={16} />
        <span>Add to queue</span>
      </button>

      {onEditMetadata ? (
        <button
          type="button"
          role="menuitem"
          className="track-ctx__item"
          onClick={() => {
            onEditMetadata()
            onClose()
          }}
        >
          <Icon name="edit" size={16} />
          <span>Edit metadata</span>
        </button>
      ) : null}

      {playlistId && onRemoveFromPlaylist ? (
        <>
          <div className="track-ctx__sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="track-ctx__item is-danger"
            onClick={() => {
              onRemoveFromPlaylist()
              onClose()
            }}
          >
            <Icon name="delete" size={16} />
            <span>Remove from playlist</span>
          </button>
        </>
      ) : null}
    </div>
  )
}
