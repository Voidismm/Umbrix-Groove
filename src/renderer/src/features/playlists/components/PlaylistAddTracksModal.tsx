import { useEffect, useMemo, useState } from 'react'
import type { TrackRow } from '@shared/types'
import { artworkUrl, formatDuration } from '@renderer/lib/format'
import { Icon } from '@renderer/components/ui/Icon'
import { ModalHeader } from '@renderer/components/ui/ModalHeader'
import '@renderer/components/ui/ModalChrome.css'
import './PlaylistAddTracksModal.css'

type PlaylistAddTracksModalProps = {
  open: boolean
  playlistName: string
  existingTrackIds: Set<string>
  onClose: () => void
  onAdd: (trackIds: string[]) => Promise<void>
}

/** Pick library tracks to append to a playlist. */
export function PlaylistAddTracksModal({
  open,
  playlistName,
  existingTrackIds,
  onClose,
  onAdd
}: PlaylistAddTracksModalProps): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelected(new Set())
    setError(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      void window.api.library
        .queryTracks({ query: query.trim() || undefined, limit: 120, sort: 'title', ascending: true })
        .then((result) => {
          if (cancelled) return
          setTracks(result.tracks)
          setError(null)
        })
        .catch((err) => {
          if (cancelled) return
          setError(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, query])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const selectable = useMemo(
    () => tracks.filter((track) => !existingTrackIds.has(track.id)),
    [tracks, existingTrackIds]
  )

  if (!open) return null

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="playlist-add" role="presentation" onClick={onClose}>
      <div
        className="playlist-add__panel gold-frame"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-add-title"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalHeader
          title="Add songs"
          titleId="playlist-add-title"
          subtitle={`to ${playlistName}`}
          seed={31}
          onClose={onClose}
          closeDisabled={saving}
        />

        <div className="playlist-add__search">
          <Icon name="browse" size={16} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your library"
            autoFocus
          />
        </div>

        <div className="playlist-add__list" role="listbox" aria-multiselectable>
          {loading ? <p className="playlist-add__empty">Searching…</p> : null}
          {!loading && error ? <p className="playlist-add__empty">{error}</p> : null}
          {!loading && !error && selectable.length === 0 ? (
            <p className="playlist-add__empty">
              {tracks.length === 0 ? 'No matching tracks.' : 'Those tracks are already in this playlist.'}
            </p>
          ) : null}
          {selectable.map((track) => {
            const checked = selected.has(track.id)
            const art = artworkUrl(track.artworkKey)
            return (
              <button
                key={track.id}
                type="button"
                role="option"
                aria-selected={checked}
                className={`playlist-add__row${checked ? ' is-selected' : ''}`}
                onClick={() => toggle(track.id)}
              >
                <span className="playlist-add__check" aria-hidden>
                  <Icon name={checked ? 'check' : 'check-empty'} size={16} />
                </span>
                <span className="playlist-add__art" aria-hidden>
                  {art ? <img src={art} alt="" /> : <Icon name="playlist" size={16} />}
                </span>
                <span className="playlist-add__meta">
                  <span className="playlist-add__title">{track.title}</span>
                  <span className="playlist-add__artist">{track.artistName}</span>
                </span>
                <span className="playlist-add__dur">
                  {track.durationMs != null ? formatDuration(track.durationMs) : '—'}
                </span>
              </button>
            )
          })}
        </div>

        <footer className="playlist-add__foot">
          <span className="playlist-add__count">
            {selected.size} selected
          </span>
          <button
            type="button"
            className="ug-modal__btn ug-modal__btn--solid"
            disabled={saving || selected.size === 0}
            onClick={() => {
              void (async () => {
                setSaving(true)
                try {
                  await onAdd([...selected])
                  onClose()
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err))
                } finally {
                  setSaving(false)
                }
              })()
            }}
          >
            {saving ? 'Adding…' : 'Add to playlist'}
          </button>
        </footer>
      </div>
    </div>
  )
}
