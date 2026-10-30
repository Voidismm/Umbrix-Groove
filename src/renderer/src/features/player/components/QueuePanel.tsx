import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { PlaylistSummary, TrackRow } from '@shared/types'
import { artworkUrl, formatDuration } from '@renderer/lib/format'
import { LazyCover } from '@renderer/components/ui/LazyCover'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { Icon } from '@renderer/components/ui/Icon'
import { hasTrackDrag, readTrackDragId } from '@renderer/features/playlists/trackDrag'
import { usePlaylists } from '@renderer/features/playlists/hooks/usePlaylists'
import { usePlayback } from '../PlaybackContext'
import './QueuePanel.css'

const VIRTUALIZE_THRESHOLD = 40
const QUEUE_ROW_ESTIMATE = 56

type QueuePanelProps = {
  /** Fill the right sidebar instead of floating as a modal. */
  embedded?: boolean
  onClose?: () => void
}

type PickerMode = 'library' | 'playlists'

export function QueuePanel({ embedded = false, onClose }: QueuePanelProps): React.JSX.Element {
  const {
    queue,
    queueIndex,
    userQueueCount,
    currentTrack,
    queueNotice,
    jumpToQueueIndex,
    removeFromQueue,
    clearQueue,
    addToQueue,
    addTracksToQueue,
    setQueueOpen
  } = usePlayback()

  const [pickerOpen, setPickerOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [dropInsertAt, setDropInsertAt] = useState<number | null>(null)
  const dropDepthRef = useRef(0)
  const dropInsertAtRef = useRef<number | null>(null)

  const added = queue.slice(queueIndex + 1, queueIndex + 1 + userQueueCount)
  const upcoming = queue.slice(queueIndex + 1 + userQueueCount)
  const addedStart = queueIndex + 1
  const addedEnd = queueIndex + 1 + userQueueCount

  const close = (): void => {
    setQueueOpen(false)
    onClose?.()
  }

  const setDropInsert = (index: number | null): void => {
    dropInsertAtRef.current = index
    setDropInsertAt(index)
  }

  const clearDropTarget = (): void => {
    dropDepthRef.current = 0
    setDropActive(false)
    setDropInsert(null)
  }

  const onTrackDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (!hasTrackDrag(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    // Rows stopPropagation — anything else appends to "Added to queue".
    setDropInsert(addedEnd)
  }

  const onTrackDragEnter = (event: DragEvent<HTMLDivElement>): void => {
    if (!hasTrackDrag(event.dataTransfer)) return
    event.preventDefault()
    dropDepthRef.current += 1
    setDropActive(true)
    setDropInsert(addedEnd)
  }

  const onTrackDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    if (!hasTrackDrag(event.dataTransfer)) return
    dropDepthRef.current = Math.max(0, dropDepthRef.current - 1)
    if (dropDepthRef.current === 0) clearDropTarget()
  }

  const onAddedRowDragOver = (event: DragEvent<HTMLElement>, index: number): void => {
    if (!hasTrackDrag(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    const rect = event.currentTarget.getBoundingClientRect()
    const before = event.clientY < rect.top + rect.height / 2
    setDropInsert(before ? index : index + 1)
    setDropActive(true)
  }

  const onAddedEmptyDragOver = (event: DragEvent<HTMLElement>): void => {
    if (!hasTrackDrag(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    setDropInsert(addedStart)
    setDropActive(true)
  }

  const onTrackDrop = (event: DragEvent<HTMLDivElement>): void => {
    if (!hasTrackDrag(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    const insertAt = dropInsertAtRef.current
    clearDropTarget()
    const trackId = readTrackDragId(event.dataTransfer)
    if (!trackId || !window.api?.library?.listTracksByIds) return
    void window.api.library.listTracksByIds([trackId]).then((tracks) => {
      const track = tracks[0]
      if (track) addToQueue(track, insertAt ?? undefined)
    })
  }

  return (
    <div
      className={`queue-panel${embedded ? ' queue-panel--embedded' : ' gold-frame'}${dropActive ? ' is-drop-target' : ''}`}
      role={embedded ? 'region' : 'dialog'}
      aria-label="Play queue"
      onDragEnter={onTrackDragEnter}
      onDragOver={onTrackDragOver}
      onDragLeave={onTrackDragLeave}
      onDrop={onTrackDrop}
    >
      <ConfirmDialog
        open={clearConfirmOpen}
        title="Clear the queue?"
        message="This wipes every track waiting in line. Now playing stops too."
        confirmLabel="Clear queue"
        cancelLabel="Keep it"
        danger
        onCancel={() => setClearConfirmOpen(false)}
        onConfirm={() => {
          clearQueue()
          setClearConfirmOpen(false)
        }}
      />

      <header className="queue-panel__head">
        <div>
          <h2>Queue</h2>
          <p>
            {queueNotice ? (
              <span className="queue-panel__notice">{queueNotice}</span>
            ) : (
              <>
                {queue.length} track{queue.length === 1 ? '' : 's'}
                {currentTrack ? ` · now ${currentTrack.title}` : ''}
              </>
            )}
          </p>
        </div>
        <div className="queue-panel__actions">
          <button
            type="button"
            className={pickerOpen ? 'is-active' : undefined}
            aria-pressed={pickerOpen}
            aria-label="Add songs to queue"
            data-groove-tip="Drop more into the queue"
            data-groove-tip-side="below"
            onClick={() => setPickerOpen((open) => !open)}
          >
            <Icon name="plus" size={16} />
          </button>
          <button
            type="button"
            data-groove-tip="Wipe the whole queue"
            data-groove-tip-side="below"
            onClick={() => {
              if (queue.length > 0) setClearConfirmOpen(true)
            }}
            disabled={queue.length === 0}
          >
            Clear
          </button>
          <button
            type="button"
            aria-label="Close queue"
            data-groove-tip="Close the queue"
            data-groove-tip-side="below"
            onClick={close}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </header>

      {pickerOpen ? (
        <QueueAddPicker
          onAddTrack={(track) => {
            addToQueue(track)
          }}
          onAddTracks={(tracks) => {
            addTracksToQueue(tracks)
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}

      {currentTrack && (
        <section className="queue-panel__section">
          <h3>Now playing</h3>
          <button
            type="button"
            className="queue-panel__row is-active"
            onClick={() => jumpToQueueIndex(queueIndex)}
          >
            <RowArt artworkKey={currentTrack.artworkKey} title={currentTrack.title} />
            <div className="queue-panel__meta">
              <strong>{currentTrack.title}</strong>
              <span>{currentTrack.artistName}</span>
            </div>
            <span className="queue-panel__dur">{formatDuration(currentTrack.durationMs)}</span>
          </button>
        </section>
      )}

      <section className="queue-panel__section">
        <h3>Added to queue</h3>
        {added.length === 0 ? (
          <p
            className={`queue-panel__empty${dropActive && dropInsertAt === addedStart ? ' is-drop-here' : ''}`}
            onDragOver={onAddedEmptyDragOver}
          >
            Nothing queued yet. Drag songs here or use + to pick.
          </p>
        ) : (
          <ul className="queue-panel__list queue-panel__list--compact">
            {added.map((track, offset) => {
              const index = queueIndex + 1 + offset
              return (
                <QueueRow
                  key={`added-${track.id}-${index}`}
                  track={track}
                  index={index}
                  onJump={jumpToQueueIndex}
                  onRemove={removeFromQueue}
                  dropBefore={dropInsertAt === index}
                  dropAfter={dropInsertAt === index + 1}
                  onDragOverRow={(event) => onAddedRowDragOver(event, index)}
                />
              )
            })}
          </ul>
        )}
      </section>

      <section className="queue-panel__section queue-panel__section--grow">
        <h3>Next up</h3>
        {upcoming.length === 0 ? (
          <p className="queue-panel__empty">Nothing waiting from the current album or playlist.</p>
        ) : (
          <VirtualQueueList
            tracks={upcoming}
            indexOffset={queueIndex + 1 + userQueueCount}
            onJump={jumpToQueueIndex}
            onRemove={removeFromQueue}
          />
        )}
        {upcoming.length === 0 && currentTrack ? (
          <QueueSuggestions
            seedTrack={currentTrack}
            excludeIds={queue.map((track) => track.id)}
            onAdd={(track) => addToQueue(track)}
          />
        ) : null}
      </section>
    </div>
  )
}

/** Related library picks when Next up is empty (short playlist / single search play). */
function QueueSuggestions({
  seedTrack,
  excludeIds,
  onAdd
}: {
  seedTrack: TrackRow
  excludeIds: string[]
  onAdd: (track: TrackRow) => void
}): React.JSX.Element | null {
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [loading, setLoading] = useState(true)
  const excludeKey = excludeIds.join('|')

  useEffect(() => {
    let cancelled = false
    const api = window.api?.library?.getRelatedTracks
    if (!api) {
      setTracks([])
      setLoading(false)
      return
    }
    setLoading(true)
    void api(seedTrack.id, 12)
      .then((related) => {
        if (cancelled) return
        const blocked = new Set(excludeIds)
        const merged: TrackRow[] = []
        const push = (row: TrackRow): void => {
          if (blocked.has(row.id)) return
          blocked.add(row.id)
          merged.push(row)
        }
        for (const row of related.sameArtist) push(row)
        for (const row of related.sameAlbum) push(row)
        for (const row of related.sameGenre) push(row)
        setTracks(merged.slice(0, 10))
      })
      .catch(() => {
        if (!cancelled) setTracks([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // excludeKey stands in for excludeIds without re-firing every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedTrack.id, excludeKey])

  if (!loading && tracks.length === 0) return null

  return (
    <div className="queue-panel__suggest">
      <h4>Suggested</h4>
      <p className="queue-panel__suggest-hint">
        {loading ? 'Finding similar tracks in your library…' : 'Add more from your library'}
      </p>
      {tracks.length > 0 ? (
        <ul className="queue-panel__list queue-panel__list--compact">
          {tracks.map((track) => (
            <li key={`suggest-${track.id}`} className="queue-panel__suggest-row">
              <button
                type="button"
                className="queue-panel__row"
                onClick={() => onAdd(track)}
                aria-label={`Add ${track.title} to queue`}
              >
                <RowArt artworkKey={track.artworkKey} title={track.title} />
                <div className="queue-panel__meta">
                  <strong>{track.title}</strong>
                  <span>{track.artistName}</span>
                </div>
              </button>
              <button
                type="button"
                className="queue-panel__suggest-add"
                aria-label={`Add ${track.title} to queue`}
                onClick={() => onAdd(track)}
              >
                <Icon name="plus" size={14} />
                Add
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function measureScrollMargin(list: HTMLElement, scroller: HTMLElement): number {
  return list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
}

function VirtualQueueList({
  tracks,
  indexOffset,
  onJump,
  onRemove
}: {
  tracks: TrackRow[]
  indexOffset: number
  onJump: (index: number) => void
  onRemove: (index: number) => void
}): React.JSX.Element {
  const listRef = useRef<HTMLUListElement>(null)
  const scrollerRef = useRef<HTMLElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)
  const virtualize = tracks.length >= VIRTUALIZE_THRESHOLD

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const candy = list.closest('.candy-scroll__viewport')
    const scroller = candy instanceof HTMLElement ? candy : list
    scrollerRef.current = scroller
    if (!virtualize || scroller === list) {
      setScrollMargin(0)
      return
    }
    const update = (): void => {
      setScrollMargin(measureScrollMargin(list, scroller))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(scroller)
    if (list.parentElement) ro.observe(list.parentElement)
    return () => ro.disconnect()
  }, [virtualize, tracks.length, tracks[0]?.id])

  const virtualizer = useVirtualizer({
    count: virtualize ? tracks.length : 0,
    getScrollElement: () => {
      if (scrollerRef.current) return scrollerRef.current
      const list = listRef.current
      if (!list) return null
      const candy = list.closest('.candy-scroll__viewport')
      if (candy instanceof HTMLElement) return candy
      return list
    },
    estimateSize: () => QUEUE_ROW_ESTIMATE,
    overscan: 6,
    enabled: virtualize,
    scrollMargin
  })

  if (!virtualize) {
    return (
      <ul className="queue-panel__list">
        {tracks.map((track, offset) => {
          const index = indexOffset + offset
          return (
            <QueueRow
              key={`next-${track.id}-${index}`}
              track={track}
              index={index}
              onJump={onJump}
              onRemove={onRemove}
            />
          )
        })}
      </ul>
    )
  }

  return (
    <ul ref={listRef} className="queue-panel__list queue-panel__list--virtual">
      <div
        className="queue-panel__virtual-spacer"
        style={{ height: virtualizer.getTotalSize() }}
        aria-hidden
      >
        {virtualizer.getVirtualItems().map((item) => {
          const track = tracks[item.index]
          const index = indexOffset + item.index
          return (
            <QueueRow
              key={`next-${track.id}-${index}`}
              track={track}
              index={index}
              onJump={onJump}
              onRemove={onRemove}
              style={{
                height: `${item.size}px`,
                transform: `translateY(${item.start}px)`
              }}
            />
          )
        })}
      </div>
    </ul>
  )
}

function QueueRow({
  track,
  index,
  onJump,
  onRemove,
  style,
  dropBefore = false,
  dropAfter = false,
  onDragOverRow
}: {
  track: TrackRow
  index: number
  onJump: (index: number) => void
  onRemove: (index: number) => void
  style?: CSSProperties
  dropBefore?: boolean
  dropAfter?: boolean
  onDragOverRow?: (event: DragEvent<HTMLLIElement>) => void
}): React.JSX.Element {
  return (
    <li
      className={[
        style ? 'is-virtual' : '',
        dropBefore ? 'is-drop-before' : '',
        dropAfter ? 'is-drop-after' : ''
      ]
        .filter(Boolean)
        .join(' ') || undefined}
      style={style}
      onDragOver={onDragOverRow}
    >
      <button type="button" className="queue-panel__row" onClick={() => onJump(index)}>
        <RowArt artworkKey={track.artworkKey} title={track.title} />
        <div className="queue-panel__meta">
          <strong>{track.title}</strong>
          <span>{track.artistName}</span>
        </div>
        <span className="queue-panel__dur">{formatDuration(track.durationMs)}</span>
      </button>
      <button
        type="button"
        className="queue-panel__remove"
        aria-label={`Remove ${track.title}`}
        data-groove-tip="Kick it off the queue"
        data-groove-tip-side="left"
        onClick={() => onRemove(index)}
      >
        <Icon name="close" size={14} />
      </button>
    </li>
  )
}

function QueueAddPicker({
  onAddTrack,
  onAddTracks,
  onClose
}: {
  onAddTrack: (track: TrackRow) => void
  onAddTracks: (tracks: TrackRow[]) => void
  onClose: () => void
}): React.JSX.Element {
  const { playlists } = usePlaylists()
  const [mode, setMode] = useState<PickerMode>('library')
  const [query, setQuery] = useState('')
  const [libraryTracks, setLibraryTracks] = useState<TrackRow[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [playlistId, setPlaylistId] = useState<string | null>(null)
  const [playlistTracks, setPlaylistTracks] = useState<TrackRow[]>([])
  const [loadingPlaylist, setLoadingPlaylist] = useState(false)

  useEffect(() => {
    if (mode !== 'library') return
    let cancelled = false
    const handle = window.setTimeout(() => {
      if (!window.api?.library?.queryTracks) {
        setLibraryTracks([])
        return
      }
      setLoadingLibrary(true)
      void window.api.library
        .queryTracks({
          query: query.trim() || undefined,
          sort: 'title',
          ascending: true,
          limit: 80
        })
        .then((result) => {
          if (cancelled) return
          setLibraryTracks(result.tracks)
        })
        .catch(() => {
          if (!cancelled) setLibraryTracks([])
        })
        .finally(() => {
          if (!cancelled) setLoadingLibrary(false)
        })
    }, 160)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [mode, query])

  useEffect(() => {
    if (!playlistId || !window.api?.playlists?.getTracks) {
      setPlaylistTracks([])
      return
    }
    let cancelled = false
    setLoadingPlaylist(true)
    void window.api.playlists
      .getTracks(playlistId)
      .then((tracks) => {
        if (!cancelled) setPlaylistTracks(tracks)
      })
      .catch(() => {
        if (!cancelled) setPlaylistTracks([])
      })
      .finally(() => {
        if (!cancelled) setLoadingPlaylist(false)
      })
    return () => {
      cancelled = true
    }
  }, [playlistId])

  const filteredPlaylists = filterPlaylists(playlists, query)

  return (
    <section className="queue-picker" aria-label="Add to queue">
      <div className="queue-picker__head">
        <strong>Add to queue</strong>
        <span>Playback only — does not change playlists</span>
        <button
          type="button"
          aria-label="Close add picker"
          data-groove-tip="Close the picker"
          onClick={onClose}
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      <div className="queue-picker__modes" role="tablist" aria-label="Add source">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'library'}
          className={mode === 'library' ? 'is-active' : undefined}
          onClick={() => {
            setMode('library')
            setPlaylistId(null)
          }}
        >
          Songs
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'playlists'}
          className={mode === 'playlists' ? 'is-active' : undefined}
          onClick={() => setMode('playlists')}
        >
          Playlists
        </button>
      </div>

      <div className="queue-picker__search">
        <input
          type="search"
          value={query}
          aria-label={mode === 'library' ? 'Search songs' : 'Search playlists'}
          placeholder={mode === 'library' ? 'Search songs…' : 'Search playlists…'}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {mode === 'library' ? (
        <ul className="queue-picker__list">
          {loadingLibrary ? (
            <li className="queue-picker__empty">Searching…</li>
          ) : libraryTracks.length === 0 ? (
            <li className="queue-picker__empty">No songs found.</li>
          ) : (
            libraryTracks.map((track) => (
              <li key={track.id}>
                <div className="queue-picker__meta">
                  <strong>{track.title}</strong>
                  <span>{track.artistName}</span>
                </div>
                <button
                  type="button"
                  aria-label={`Add ${track.title} to queue`}
                  data-groove-tip="Drop into the queue"
                  data-groove-tip-side="left"
                  onClick={() => onAddTrack(track)}
                >
                  <Icon name="plus" size={14} />
                </button>
              </li>
            ))
          )}
        </ul>
      ) : playlistId ? (
        <div className="queue-picker__playlist">
          <div className="queue-picker__playlist-bar">
            <button
              type="button"
              className="queue-picker__back"
              data-groove-tip="Back to playlists"
              onClick={() => setPlaylistId(null)}
            >
              ← Back
            </button>
            <button
              type="button"
              className="queue-picker__add-all"
              data-groove-tip="Queue the whole set"
              disabled={playlistTracks.length === 0 || loadingPlaylist}
              onClick={() => {
                if (playlistTracks.length > 0) onAddTracks(playlistTracks)
              }}
            >
              Add all to queue
            </button>
          </div>
          <ul className="queue-picker__list">
            {loadingPlaylist ? (
              <li className="queue-picker__empty">Loading…</li>
            ) : playlistTracks.length === 0 ? (
              <li className="queue-picker__empty">This playlist is empty.</li>
            ) : (
              playlistTracks.map((track) => (
                <li key={`${playlistId}-${track.id}`}>
                  <div className="queue-picker__meta">
                    <strong>{track.title}</strong>
                    <span>{track.artistName}</span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Add ${track.title} to queue`}
                    data-groove-tip="Drop into the queue"
                    data-groove-tip-side="left"
                    onClick={() => onAddTrack(track)}
                  >
                    <Icon name="plus" size={14} />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : (
        <ul className="queue-picker__list">
          {filteredPlaylists.length === 0 ? (
            <li className="queue-picker__empty">No playlists found.</li>
          ) : (
            filteredPlaylists.map((playlist) => (
              <li key={playlist.id}>
                <button
                  type="button"
                  className="queue-picker__playlist-row"
                  onClick={() => setPlaylistId(playlist.id)}
                >
                  <div className="queue-picker__meta">
                    <strong>{playlist.name}</strong>
                    <span>
                      {playlist.trackCount} track{playlist.trackCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <Icon name="next" size={14} />
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  )
}

function filterPlaylists(playlists: PlaylistSummary[], query: string): PlaylistSummary[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return playlists
  return playlists.filter((item) => item.name.toLowerCase().includes(needle))
}

function RowArt({
  artworkKey,
  title
}: {
  artworkKey: string | null
  title: string
}): React.JSX.Element {
  return <LazyCover src={artworkUrl(artworkKey)} label={title} className="queue-panel__art" />
}
