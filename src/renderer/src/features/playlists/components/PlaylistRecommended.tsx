import { useCallback, useEffect, useRef, useState } from 'react'
import type { TrackRow } from '@shared/types'
import { usePlayback } from '@renderer/features/player'
import { artworkUrl } from '@renderer/lib/format'
import { Icon } from '@renderer/components/ui/Icon'
import { usePlaylists } from '../hooks/usePlaylists'
import './PlaylistRecommended.css'

type PlaylistRecommendedProps = {
  playlistId: string
  /** Re-fetch when playlist membership changes. */
  seedKey: string
  /** Hide the block entirely when the playlist has no tracks. */
  hasSeeds: boolean
}

/** Local vibe-matched suggestions below a playlist track list. */
export function PlaylistRecommended({
  playlistId,
  seedKey,
  hasSeeds
}: PlaylistRecommendedProps): React.JSX.Element | null {
  const { addTracks } = usePlaylists()
  const { playTrack, currentTrack, isPlaying, togglePlay, focusTrack } = usePlayback()
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [salt, setSalt] = useState(() => Date.now())
  const [apiMissing, setApiMissing] = useState(false)
  const tracksRef = useRef<TrackRow[]>([])
  const requestId = useRef(0)

  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  const load = useCallback(
    async (nextSalt: number, preferFresh: boolean) => {
      if (!hasSeeds) {
        setTracks([])
        setLoading(false)
        setApiMissing(false)
        return
      }
      if (!window.api?.playlists?.getRecommendations) {
        setTracks([])
        setLoading(false)
        setApiMissing(true)
        return
      }
      setApiMissing(false)
      const id = ++requestId.current
      setLoading(true)
      const excludeIds = preferFresh ? tracksRef.current.map((track) => track.id) : []
      try {
        const next = await window.api.playlists.getRecommendations(playlistId, 18, {
          excludeIds,
          salt: nextSalt
        })
        if (id !== requestId.current) return
        setTracks(next)
        setSalt(nextSalt)
      } catch {
        if (id !== requestId.current) return
        setTracks([])
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [playlistId, hasSeeds]
  )

  // Fresh batch whenever you open / return to the playlist, or when membership changes.
  useEffect(() => {
    void load(Date.now(), false)
  }, [playlistId, seedKey, load])

  const refresh = () => {
    void load(Date.now(), true)
  }

  if (!hasSeeds) return null

  return (
    <section className="playlist-rec" aria-label="Recommended">
      <header className="playlist-rec__head">
        <div className="playlist-rec__titles">
          <h2>Recommended</h2>
          <p>
            {apiMissing
              ? 'Restart the app to enable recommendations'
              : loading && tracks.length === 0
                ? 'Matching similar vibes from your library…'
                : tracks.length === 0
                  ? 'No close matches in your library yet — try Refresh after you add more songs elsewhere'
                  : 'Similar vibes from your library — updates as this playlist grows'}
          </p>
        </div>
        <button
          type="button"
          className="playlist-rec__refresh"
          onClick={refresh}
          disabled={loading || apiMissing}
          aria-label="Refresh recommended tracks"
        >
          <Icon name="shuffle" size={14} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {tracks.length > 0 ? (
        <ul className="playlist-rec__list">
          {tracks.map((track) => {
            const art = artworkUrl(track.artworkKey)
            const busy = addingId === track.id
            const active = currentTrack?.id === track.id
            return (
              <li
                key={`${track.id}:${salt}`}
                className={`playlist-rec__row${active ? ' is-active' : ''}`}
              >
                <button
                  type="button"
                  className="playlist-rec__play"
                  aria-label={
                    active && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`
                  }
                  onClick={() => {
                    focusTrack(track)
                    if (active) togglePlay()
                    else playTrack(track, tracks)
                  }}
                >
                  {active && isPlaying ? (
                    <Icon name="pause" size={20} />
                  ) : (
                    <Icon name="play" size={20} />
                  )}
                </button>
                <button
                  type="button"
                  className="playlist-rec__main"
                  aria-label={`Play ${track.title}`}
                  onDoubleClick={() => playTrack(track, tracks)}
                  onClick={() => focusTrack(track)}
                >
                  <span className="playlist-rec__art" aria-hidden>
                    {art ? <img src={art} alt="" /> : <Icon name="playlist" size={16} />}
                  </span>
                  <span className="playlist-rec__meta">
                    <strong>{track.title}</strong>
                    <span>{track.artistName}</span>
                  </span>
                  <span className="playlist-rec__album">{track.albumTitle}</span>
                </button>
                <button
                  type="button"
                  className="playlist-rec__add"
                  disabled={busy || loading}
                  onClick={() => {
                    setAddingId(track.id)
                    void addTracks(playlistId, [track.id])
                      .then(() => {
                        setTracks((prev) => prev.filter((item) => item.id !== track.id))
                      })
                      .finally(() => setAddingId(null))
                  }}
                >
                  {busy ? 'Adding…' : 'Add'}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
