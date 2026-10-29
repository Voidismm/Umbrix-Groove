import { useEffect, useMemo, useState } from 'react'
import type { TrackSort } from '@shared/types'
import { useLibrary } from '@renderer/features/library'
import { PlaylistTrackTable } from '@renderer/features/playlists'
import { usePlayback } from '@renderer/features/player'
import { artworkUrl, formatDuration } from '@renderer/lib/format'
import {
  DEFAULT_PLAYLIST_ACCENT,
  extractAccentFromImageUrl,
  playlistBannerStyle
} from '@renderer/lib/playlistAccent'
import { Icon } from '@renderer/components/ui/Icon'

function formatLibraryLength(ms: number): string {
  if (!ms || ms <= 0) return ''
  const totalSec = Math.round(ms / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  if (hours > 0) return `${hours} hr ${minutes} min`
  return `${minutes} min ${seconds.toString().padStart(2, '0')} sec`
}

/** First up to 4 unique artwork keys in library order. */
function coverArtKeys(tracks: { artworkKey: string | null }[]): string[] {
  const keys: string[] = []
  for (const track of tracks) {
    if (track.artworkKey && !keys.includes(track.artworkKey)) keys.push(track.artworkKey)
    if (keys.length >= 4) break
  }
  return keys
}

/** All Songs — same detail chrome as Loved Songs (play, shuffle, mix, track list). */
export function SongsPage(): React.JSX.Element {
  const { tracks, trackTotal, searchQuery, sort, setSort } = useLibrary()
  const { playTrack, shuffle, toggleShuffle } = usePlayback()
  const [derivedAccent, setDerivedAccent] = useState(DEFAULT_PLAYLIST_ACCENT)

  useEffect(() => {
    setSort('date_added')
  }, [setSort])

  const artKeys = useMemo(() => coverArtKeys(tracks), [tracks])
  const coverSampleUrl = useMemo(
    () => (artKeys[0] ? artworkUrl(artKeys[0]) : null),
    [artKeys]
  )

  const totalDurationMs = useMemo(
    () => tracks.reduce((sum, track) => sum + (track.durationMs ?? 0), 0),
    [tracks]
  )

  const bannerStyle = useMemo(() => playlistBannerStyle(derivedAccent), [derivedAccent])
  const lengthLabel = formatLibraryLength(totalDurationMs)
  const songLabel = searchQuery
    ? `${trackTotal} match${trackTotal === 1 ? '' : 'es'}`
    : `${trackTotal} song${trackTotal === 1 ? '' : 's'}`

  useEffect(() => {
    if (!coverSampleUrl) {
      setDerivedAccent(DEFAULT_PLAYLIST_ACCENT)
      return
    }
    let cancelled = false
    void extractAccentFromImageUrl(coverSampleUrl).then((hex) => {
      if (cancelled) return
      setDerivedAccent(hex ?? DEFAULT_PLAYLIST_ACCENT)
    })
    return () => {
      cancelled = true
    }
  }, [coverSampleUrl])

  return (
    <section className="playlists-page">
      <header className="playlists-page__detail" style={bannerStyle}>
        <div className="playlists-page__detail-main">
          <div
            className={`playlists-page__cover${artKeys.length >= 4 ? ' is-collage' : ''}`}
            aria-hidden
          >
            {artKeys.length >= 4 ? (
              artKeys.map((key) => <img key={key} src={artworkUrl(key) ?? undefined} alt="" />)
            ) : artKeys[0] ? (
              <img src={artworkUrl(artKeys[0]) ?? undefined} alt="" />
            ) : (
              <Icon name="queue" size={56} />
            )}
          </div>

          <div className="playlists-page__info">
            <p className="playlists-page__kind">Library</p>
            <h1 className="playlists-page__title">All Songs</h1>
            {searchQuery ? (
              <p className="playlists-page__desc">Results for “{searchQuery}”</p>
            ) : null}
            <p className="playlists-page__meta">
              <span>{songLabel}</span>
              {lengthLabel ? <span>· {lengthLabel}</span> : null}
              {totalDurationMs > 0 ? (
                <span className="playlists-page__meta-faint">
                  ({formatDuration(totalDurationMs)})
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="playlists-page__controls">
          <button
            type="button"
            className="playlists-page__play"
            disabled={tracks.length === 0}
            aria-label="Play All Songs"
            onClick={() => {
              if (tracks[0]) playTrack(tracks[0], tracks)
            }}
          >
            <Icon name="play" size={28} className="playlists-page__play-icon" />
          </button>

          <button
            type="button"
            className={`playlists-page__icon-btn${shuffle ? ' is-active' : ''}`}
            aria-label="Shuffle"
            aria-pressed={shuffle}
            onClick={toggleShuffle}
          >
            <Icon name="shuffle" size={22} />
          </button>

          <div className="playlists-page__pills">
            <button
              type="button"
              className="playlists-page__pill"
              disabled={tracks.length === 0}
              onClick={() => {
                const start = tracks[Math.floor(Math.random() * tracks.length)]
                if (start) playTrack(start, tracks, { forceShuffle: true })
              }}
            >
              <Icon name="shuffle" size={14} />
              Mix
            </button>

            <label className="playlists-page__pill playlists-page__pill--sort">
              Sort
              <select
                value={sort}
                aria-label="Sort songs"
                onChange={(event) => setSort(event.target.value as TrackSort)}
              >
                <option value="title">Title</option>
                <option value="artist">Artist</option>
                <option value="album">Album</option>
                <option value="duration">Duration</option>
                <option value="date_added">Date added</option>
              </select>
            </label>
          </div>
        </div>
      </header>

      <PlaylistTrackTable
        tracks={tracks}
        emptyMessage={
          searchQuery
            ? 'No songs match this search.'
            : 'No songs in your library yet. Add music folders in Settings.'
        }
      />
    </section>
  )
}
