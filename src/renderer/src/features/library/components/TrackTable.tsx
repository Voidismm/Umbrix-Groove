import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { TrackRow, TrackSort } from '@shared/types'
import { usePlayback } from '@renderer/features/player'
import { TrackContextMenu } from '@renderer/features/playlists'
import { usePlaylists } from '@renderer/features/playlists/hooks/usePlaylists'
import { setTrackDragData } from '@renderer/features/playlists/trackDrag'
import { artworkUrl, formatDuration } from '@renderer/lib/format'
import { Icon } from '@renderer/components/ui/Icon'
import { LazyCover } from '@renderer/components/ui/LazyCover'
import { useLibrary } from '../hooks/useLibrary'
import { TrackEditModal } from './TrackEditModal'
import './TrackTable.css'

type TrackTableProps = {
  tracks: TrackRow[]
  total: number
  showSort?: boolean
}

type MenuState = { x: number; y: number; track: TrackRow }

const VIRTUALIZE_THRESHOLD = 40
/** Matches row padding + 40px art. */
const TRACK_ROW_ESTIMATE = 56

function measureScrollMargin(list: HTMLElement, scroller: HTMLElement): number {
  return list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
}

export function TrackTable({ tracks, total, showSort = true }: TrackTableProps): React.JSX.Element {
  const { sort, setSort, refresh } = useLibrary()
  const {
    playTrack,
    playNext,
    addToQueue,
    currentTrack,
    isPlaying,
    togglePlay,
    syncTrackRow
  } = usePlayback()
  const {
    playlists,
    askCreatePlaylistWithTracks,
    addTracks,
    toggleLiked,
    isLiked,
    refresh: refreshPlaylists
  } = usePlaylists()
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [editTrack, setEditTrack] = useState<TrackRow | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)
  const scrollerRef = useRef<HTMLElement | null>(null)
  const virtualize = tracks.length >= VIRTUALIZE_THRESHOLD

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const scroller = list.closest('.candy-scroll__viewport') as HTMLElement | null
    scrollerRef.current = scroller
    if (!scroller || !virtualize) {
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
    return () => {
      ro.disconnect()
    }
  }, [virtualize, tracks.length, tracks[0]?.id])

  const virtualizer = useVirtualizer({
    count: virtualize ? tracks.length : 0,
    getScrollElement: () => {
      if (scrollerRef.current) return scrollerRef.current
      const el = listRef.current?.closest('.candy-scroll__viewport')
      return el instanceof HTMLElement ? el : null
    },
    estimateSize: () => TRACK_ROW_ESTIMATE,
    overscan: 10,
    enabled: virtualize,
    scrollMargin
  })

  const renderRow = (track: TrackRow, index: number, style?: CSSProperties): React.JSX.Element => {
    const art = artworkUrl(track.artworkKey)
    const active = currentTrack?.id === track.id
    return (
      <li
        key={track.id}
        className={`track-table__row${active ? ' is-active' : ''}${style ? ' is-virtual' : ''}`}
        style={style}
        draggable
        onDragStart={(event) => {
          setTrackDragData(event.dataTransfer, track.id)
          event.dataTransfer.effectAllowed = 'copy'
        }}
        onDoubleClick={() => playTrack(track, tracks)}
        onContextMenu={(event) => {
          event.preventDefault()
          setMenu({ x: event.clientX, y: event.clientY, track })
        }}
      >
        <button
          type="button"
          className="track-table__num-btn"
          aria-label={active && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          data-no-groove-tip
          onClick={() => {
            if (active) togglePlay()
            else playTrack(track, tracks)
          }}
        >
          {active && isPlaying ? (
            <Icon name="pause" />
          ) : (
            <>
              <span className="track-table__index">{track.trackNumber ?? index + 1}</span>
              <Icon name="play" className="track-table__play-icon" />
            </>
          )}
        </button>
        <div className="track-table__title">
          <LazyCover src={art} label={track.title} className="track-table__art" />
          <div>
            <strong>
              {track.title}
              {track.incompleteMetadata ? (
                <em className="track-table__flag" title="Incomplete metadata">
                  {' '}
                  · incomplete tags
                </em>
              ) : null}
            </strong>
            <span>{track.artistName}</span>
          </div>
        </div>
        <span className="track-table__album">{track.albumTitle}</span>
        <span className="track-table__date">{new Date(track.dateAdded).toLocaleDateString()}</span>
        <div className="track-table__end">
          <span className="track-table__duration">{formatDuration(track.durationMs)}</span>
        </div>
      </li>
    )
  }

  return (
    <div className="track-table gold-frame">
      <div className="track-table__meta">
        <span>
          {total} song{total === 1 ? '' : 's'}
          <em className="track-table__hint"> · double-click to play · right-click for more</em>
        </span>
        {showSort && (
          <label>
            Sort
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as TrackSort)}
            >
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="album">Album</option>
              <option value="duration">Duration</option>
              <option value="date_added">Date added</option>
              <option value="track_number">Track number</option>
            </select>
          </label>
        )}
      </div>

      <div className="track-table__head" aria-hidden>
        <span>#</span>
        <span>Title</span>
        <span>Album</span>
        <span>Date added</span>
        <span>Duration</span>
      </div>

      {tracks.length === 0 ? (
        <div className="track-table__empty">No tracks match this view yet.</div>
      ) : virtualize ? (
        <ul
          ref={listRef}
          className="track-table__list track-table__list--virtual track-table__list--page-scroll"
        >
          <div
            className="track-table__virtual-spacer"
            style={{ height: virtualizer.getTotalSize() }}
            aria-hidden
          >
            {virtualizer.getVirtualItems().map((item) => {
              const track = tracks[item.index]
              return renderRow(track, item.index, {
                height: `${item.size}px`,
                transform: `translateY(${item.start - scrollMargin}px)`
              })
            })}
          </div>
        </ul>
      ) : (
        <ul ref={listRef} className="track-table__list">
          {tracks.map((track, index) => renderRow(track, index))}
        </ul>
      )}

      {menu ? (
        <TrackContextMenu
          x={menu.x}
          y={menu.y}
          track={menu.track}
          liked={isLiked(menu.track.id)}
          playlists={playlists}
          onClose={() => setMenu(null)}
          onAddToPlaylist={(playlistId) => {
            void addTracks(playlistId, [menu.track.id])
          }}
          onNewPlaylist={() => askCreatePlaylistWithTracks([menu.track.id])}
          onToggleLoved={() => {
            void toggleLiked(menu.track.id)
          }}
          onPlayNext={() => playNext(menu.track)}
          onAddToQueue={() => addToQueue(menu.track)}
          onEditMetadata={() => setEditTrack(menu.track)}
        />
      ) : null}

      {editTrack ? (
        <TrackEditModal
          open
          track={editTrack}
          onClose={() => setEditTrack(null)}
          onSaved={(updated) => {
            syncTrackRow(updated)
            void refresh()
            void refreshPlaylists()
          }}
        />
      ) : null}
    </div>
  )
}
