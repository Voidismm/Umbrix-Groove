import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PlaylistSummary } from '@shared/types'
import { Icon } from '@renderer/components/ui/Icon'
import './AddToPlaylistPicker.css'

export type AddToPlaylistPickerProps = {
  playlists: PlaylistSummary[]
  /** Fixed viewport anchor for standalone popovers. Omit when parent positions the panel. */
  anchor?: { x: number; y: number }
  className?: string
  onSelectPlaylist: (playlistId: string) => void
  onNewPlaylist: () => void
  onClose: () => void
}

function playlistLabel(playlist: PlaylistSummary): string {
  if (playlist.systemKey === 'liked' || playlist.name === 'Liked Songs') return 'Loved Songs'
  return playlist.name
}

/** Searchable playlist picker — New playlist + scrollable user playlists. */
export function AddToPlaylistPicker({
  playlists,
  anchor,
  className,
  onSelectPlaylist,
  onNewPlaylist,
  onClose
}: AddToPlaylistPickerProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')

  const choices = useMemo(() => {
    const user = playlists.filter((item) => !item.isSystem)
    const q = query.trim().toLowerCase()
    if (!q) return user
    return user.filter((item) => item.name.toLowerCase().includes(q))
  }, [playlists, query])

  useLayoutEffect(() => {
    if (!anchor) return
    const el = ref.current
    if (!el) return
    const pad = 8
    const rect = el.getBoundingClientRect()
    let left = anchor.x
    // Grow upward from the anchor (footer + button sits low).
    let top = anchor.y - rect.height
    if (top < pad) top = pad
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad)
    }
    if (left < pad) left = pad
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad)
    }
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }, [anchor, choices.length, query])

  // Standalone popovers own dismiss; nested flyouts defer to the parent menu.
  useEffect(() => {
    if (!anchor) return
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
  }, [anchor, onClose])

  return (
    <div
      ref={ref}
      className={`add-to-playlist-picker${anchor ? ' is-fixed' : ''}${className ? ` ${className}` : ''}`}
      role="menu"
      aria-label="Add to playlist"
      style={anchor ? { left: anchor.x, top: anchor.y } : undefined}
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <label className="add-to-playlist-picker__search">
        <span className="add-to-playlist-picker__visually-hidden">Find a playlist</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a playlist"
          autoComplete="off"
          autoFocus
        />
      </label>

      <button
        type="button"
        role="menuitem"
        className="add-to-playlist-picker__row add-to-playlist-picker__row--action"
        onClick={() => {
          onNewPlaylist()
          onClose()
        }}
      >
        <Icon name="create-playlist" size={16} />
        <span>New playlist</span>
      </button>

      <div className="add-to-playlist-picker__list" role="group" aria-label="Your playlists">
        {choices.length === 0 ? (
          <p className="add-to-playlist-picker__empty">
            {query.trim() ? 'No playlists match.' : 'No playlists yet.'}
          </p>
        ) : (
          choices.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              role="menuitem"
              className="add-to-playlist-picker__row"
              onClick={() => {
                onSelectPlaylist(playlist.id)
                onClose()
              }}
            >
              <Icon name="playlist" size={16} />
              <span title={playlistLabel(playlist)}>{playlistLabel(playlist)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
