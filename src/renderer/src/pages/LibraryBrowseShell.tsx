import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { TrackSort } from '@shared/types'
import { useLibrary } from '@renderer/features/library'
import { usePlayback } from '@renderer/features/player'
import { artworkUrl, formatDuration } from '@renderer/lib/format'
import {
  DEFAULT_PLAYLIST_ACCENT,
  extractAccentFromImageUrl,
  playlistBannerStyle
} from '@renderer/lib/playlistAccent'
import { Icon } from '@renderer/components/ui/Icon'
import { LibraryBrowseTabs } from '@renderer/components/ui/LibraryBrowseTabs'

function formatLibraryLength(ms: number): string {
  if (!ms || ms <= 0) return ''
  const totalSec = Math.round(ms / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  if (hours > 0) return `${hours} hr ${minutes} min`
  return `${minutes} min ${seconds.toString().padStart(2, '0')} sec`
}

function coverArtKeys(items: { artworkKey: string | null }[]): string[] {
  const keys: string[] = []
  for (const item of items) {
    if (item.artworkKey && !keys.includes(item.artworkKey)) keys.push(item.artworkKey)
    if (keys.length >= 4) break
  }
  return keys
}

type LibraryBrowseShellProps = {
  title: string
  description?: string | null
  metaPrimary: string
  /** Fallback icon when no artwork. */
  icon?: 'queue' | 'album' | 'artist'
  /** Artwork sources for the collage (tracks or albums). */
  artItems: { artworkKey: string | null }[]
  showSort?: boolean
  children: ReactNode
}

/** Shared All Songs-style banner + tabs; body content swaps per library page. */
export function LibraryBrowseShell({
  title,
  description,
  metaPrimary,
  icon = 'queue',
  artItems,
  showSort = false,
  children
}: LibraryBrowseShellProps): React.JSX.Element {
  const { tracks, sort, setSort } = useLibrary()
  const { playTrack, shuffle, toggleShuffle } = usePlayback()
  const [derivedAccent, setDerivedAccent] = useState(DEFAULT_PLAYLIST_ACCENT)

  const artKeys = useMemo(() => coverArtKeys(artItems), [artItems])
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
              <Icon name={icon} size={56} />
            )}
          </div>

          <div className="playlists-page__info">
            <p className="playlists-page__kind">Library</p>
            <h1 className="playlists-page__title">{title}</h1>
            {description ? <p className="playlists-page__desc">{description}</p> : null}
            <p className="playlists-page__meta">
              <span>{metaPrimary}</span>
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
            aria-label={`Play ${title}`}
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

            {showSort ? (
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
            ) : null}
          </div>
        </div>
      </header>

      <LibraryBrowseTabs />

      {children}
    </section>
  )
}
