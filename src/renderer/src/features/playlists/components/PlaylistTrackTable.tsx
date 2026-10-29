import { useState } from 'react'
import type { TrackRow } from '@shared/types'
import { usePlayback } from '@renderer/features/player'
import { artworkUrl, formatDuration } from '@renderer/lib/format'
import { Icon } from '@renderer/components/ui/Icon'
import { usePlaylists } from '../hooks/usePlaylists'
import { setTrackDragData } from '../trackDrag'
import { TrackContextMenu } from './TrackContextMenu'
import '../../library/components/TrackTable.css'
import './PlaylistTrackTable.css'

type PlaylistTrackTableProps = {
  /** When set, enables playlist reorder + remove. Omit for library views like All Songs. */
  playlistId?: string
  tracks: TrackRow[]
  emptyMessage?: string
}

type MenuState = { x: number; y: number; track: TrackRow }

function formatAdded(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Spotify-style track list — playlist reorder when playlistId is set; right-click for actions. */
export function PlaylistTrackTable({
  playlistId,
  tracks,
  emptyMessage
}: PlaylistTrackTableProps): React.JSX.Element {
  const {
    playTrack,
    playNext,
    addToQueue,
    currentTrack,
    focusedTrack,
    focusTrack,
    isPlaying,
    togglePlay
  } = usePlayback()
  const {
    playlists,
    reorderTracks,
    removeTrack,
    toggleLiked,
    isLiked,
    askCreatePlaylistWithTracks,
    addTracks
  } = usePlaylists()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [dropPlacement, setDropPlacement] = useState<'before' | 'after'>('before')
  const [menu, setMenu] = useState<MenuState | null>(null)
  const isPlaylist = !!playlistId

  const clearDrag = (): void => {
    setDragIndex(null)
    setDropIndex(null)
  }

  const onDropAt = (targetIndex: number, placement: 'before' | 'after'): void => {
    if (!playlistId || dragIndex == null) {
      clearDrag()
      return
    }
    let insertAt = placement === 'before' ? targetIndex : targetIndex + 1
    if (dragIndex < insertAt) insertAt -= 1
    if (insertAt === dragIndex) {
      clearDrag()
      return
    }
    const next = [...tracks]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(insertAt, 0, moved)
    clearDrag()
    void reorderTracks(
      playlistId,
      next.map((track) => track.id)
    )
  }

  return (
    <div className="track-table playlist-tracks">
      <div className="track-table__head playlist-tracks__head" aria-hidden>
        <span>#</span>
        <span>Title</span>
        <span>Album</span>
        <span>Date added</span>
        <span className="playlist-tracks__clock" title="Duration">
          <Icon name="duration" size={14} />
        </span>
      </div>

      {tracks.length === 0 ? (
        <div className="track-table__empty">
          {emptyMessage ??
            'This playlist is empty. Right-click a song elsewhere and choose Add to playlist, or drag a song onto this playlist in the sidebar.'}
        </div>
      ) : (
        <ul className={`track-table__list playlist-tracks__list${dragIndex != null ? ' is-dnd' : ''}`}>
          {tracks.map((track, index) => {
            const art = artworkUrl(track.artworkKey)
            const active = currentTrack?.id === track.id
            const focused = focusedTrack?.id === track.id
            const liked = isLiked(track.id)
            const showBefore = dropIndex === index && dropPlacement === 'before'
            const showAfter = dropIndex === index && dropPlacement === 'after'
            return (
              <li
                key={track.id}
                className={[
                  'track-table__row',
                  'playlist-tracks__row',
                  active ? 'is-active' : '',
                  focused && !active ? 'is-focused' : '',
                  dragIndex === index ? 'is-dragging' : '',
                  showBefore ? 'is-drop-before' : '',
                  showAfter ? 'is-drop-after' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable
                onDragStart={(event) => {
                  setTrackDragData(event.dataTransfer, track.id)
                  if (isPlaylist) {
                    setDragIndex(index)
                    event.dataTransfer.effectAllowed = 'copyMove'
                  } else {
                    event.dataTransfer.effectAllowed = 'copy'
                  }
                }}
                onDragOver={
                  isPlaylist
                    ? (event) => {
                        if (dragIndex == null || dragIndex === index) return
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                        const rect = event.currentTarget.getBoundingClientRect()
                        const before = event.clientY < rect.top + rect.height / 2
                        setDropIndex(index)
                        setDropPlacement(before ? 'before' : 'after')
                      }
                    : undefined
                }
                onDrop={
                  isPlaylist
                    ? (event) => {
                        event.preventDefault()
                        const rect = event.currentTarget.getBoundingClientRect()
                        const before = event.clientY < rect.top + rect.height / 2
                        onDropAt(index, before ? 'before' : 'after')
                      }
                    : undefined
                }
                onDragEnd={clearDrag}
                onClick={() => focusTrack(track)}
                onDoubleClick={() => playTrack(track, tracks)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  focusTrack(track)
                  setMenu({ x: event.clientX, y: event.clientY, track })
                }}
              >
                <button
                  type="button"
                  className="track-table__num-btn"
                  aria-label={active && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    focusTrack(track)
                    if (active) togglePlay()
                    else playTrack(track, tracks)
                  }}
                >
                  {active && isPlaying ? (
                    <Icon name="pause" size={20} />
                  ) : (
                    <>
                      <span className="track-table__index">{index + 1}</span>
                      <Icon name="play" className="track-table__play-icon" size={20} />
                    </>
                  )}
                </button>
                <div className="track-table__title">
                  <div className="track-table__art" aria-hidden>
                    {art ? <img src={art} alt="" /> : <span>{track.title.slice(0, 1)}</span>}
                  </div>
                  <div>
                    <strong>{track.title}</strong>
                    <span>{track.artistName}</span>
                  </div>
                </div>
                <span className="track-table__album">{track.albumTitle}</span>
                <span className="track-table__date">{formatAdded(track.dateAdded)}</span>
                <div className="track-table__end">
                  <button
                    type="button"
                    className={`playlist-tracks__like${liked ? ' is-liked' : ''}`}
                    title={liked ? 'Unlove' : 'Love'}
                    aria-label={liked ? `Unlove ${track.title}` : `Love ${track.title}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      void toggleLiked(track.id)
                    }}
                  >
                    <Icon name={liked ? 'heart-filled' : 'heart'} size={20} />
                  </button>
                  <span className="track-table__duration">{formatDuration(track.durationMs)}</span>
                  <button
                    type="button"
                    className="playlist-tracks__more"
                    title="More"
                    aria-label={`More actions for ${track.title}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      const rect = event.currentTarget.getBoundingClientRect()
                      setMenu({
                        x: Math.round(rect.left + rect.width / 2),
                        y: Math.round(rect.top),
                        track
                      })
                    }}
                  >
                    <Icon name="more" size={18} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {menu ? (
        <TrackContextMenu
          x={menu.x}
          y={menu.y}
          track={menu.track}
          liked={isLiked(menu.track.id)}
          playlists={playlists}
          playlistId={playlistId}
          onClose={() => setMenu(null)}
          onAddToPlaylist={(id) => {
            void addTracks(id, [menu.track.id])
          }}
          onNewPlaylist={() => askCreatePlaylistWithTracks([menu.track.id])}
          onToggleLoved={() => {
            void toggleLiked(menu.track.id)
          }}
          onPlayNext={() => playNext(menu.track)}
          onAddToQueue={() => addToQueue(menu.track)}
          onRemoveFromPlaylist={
            playlistId
              ? () => {
                  void removeTrack(playlistId, menu.track.id)
                }
              : undefined
          }
        />
      ) : null}
    </div>
  )
}
