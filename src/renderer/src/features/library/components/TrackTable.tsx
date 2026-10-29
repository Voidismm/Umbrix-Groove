import { useState } from 'react'
import type { TrackRow, TrackSort } from '@shared/types'
import { usePlayback } from '@renderer/features/player'
import { TrackContextMenu } from '@renderer/features/playlists'
import { usePlaylists } from '@renderer/features/playlists/hooks/usePlaylists'
import { setTrackDragData } from '@renderer/features/playlists/trackDrag'
import { artworkUrl, formatDuration } from '@renderer/lib/format'
import { Icon } from '@renderer/components/ui/Icon'
import { useLibrary } from '../hooks/useLibrary'
import './TrackTable.css'

type TrackTableProps = {
  tracks: TrackRow[]
  total: number
  showSort?: boolean
}

type MenuState = { x: number; y: number; track: TrackRow }

export function TrackTable({ tracks, total, showSort = true }: TrackTableProps): React.JSX.Element {
  const { sort, setSort } = useLibrary()
  const { playTrack, playNext, addToQueue, currentTrack, isPlaying, togglePlay } = usePlayback()
  const { playlists, askCreatePlaylistWithTracks, addTracks, toggleLiked, isLiked } = usePlaylists()
  const [menu, setMenu] = useState<MenuState | null>(null)

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
      ) : (
        <ul className="track-table__list">
          {tracks.map((track, index) => {
            const art = artworkUrl(track.artworkKey)
            const active = currentTrack?.id === track.id
            return (
              <li
                key={track.id}
                className={`track-table__row${active ? ' is-active' : ''}`}
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
                  <div className="track-table__art" aria-hidden>
                    {art ? <img src={art} alt="" /> : <span>{track.title.slice(0, 1)}</span>}
                  </div>
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
                <span className="track-table__date">
                  {new Date(track.dateAdded).toLocaleDateString()}
                </span>
                <div className="track-table__end">
                  <span className="track-table__duration">{formatDuration(track.durationMs)}</span>
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
        />
      ) : null}
    </div>
  )
}
