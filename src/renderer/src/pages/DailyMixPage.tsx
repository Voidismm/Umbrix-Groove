import { useEffect, useMemo, useState } from 'react'
import { PlaylistTrackTable } from '@renderer/features/playlists'
import { useLibrary } from '@renderer/features/library'
import { usePlayback } from '@renderer/features/player'
import { artworkUrl, formatDuration } from '@renderer/lib/format'
import {
  DEFAULT_PLAYLIST_ACCENT,
  extractAccentFromImageUrl,
  normalizeHexColor,
  playlistBannerStyle
} from '@renderer/lib/playlistAccent'
import { Icon } from '@renderer/components/ui/Icon'

function formatPlaylistLength(ms: number): string {
  if (!ms || ms <= 0) return ''
  const totalSec = Math.round(ms / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  if (hours > 0) return `${hours} hr ${minutes} min`
  return `${minutes} min ${seconds.toString().padStart(2, '0')} sec`
}

/** Daily Mix detail — browse tracks, then Play / Shuffle / Mix when you want. */
export function DailyMixPage(): React.JSX.Element {
  const { selectedDailyMix, clearDailyMix } = useLibrary()
  const { playTrack, shuffle, toggleShuffle } = usePlayback()
  const [derivedAccent, setDerivedAccent] = useState(DEFAULT_PLAYLIST_ACCENT)

  const mix = selectedDailyMix
  const tracks = mix?.tracks ?? []
  const artKeys = mix?.coverArtKeys ?? []

  const coverSampleUrl = useMemo(() => {
    if (artKeys[0]) return artworkUrl(artKeys[0])
    return null
  }, [artKeys])

  const savedAccent = normalizeHexColor(mix?.accentColor)
  const bannerAccent = savedAccent ?? derivedAccent
  const bannerStyle = useMemo(() => playlistBannerStyle(bannerAccent), [bannerAccent])

  const totalDurationMs = useMemo(
    () => tracks.reduce((sum, track) => sum + (track.durationMs || 0), 0),
    [tracks]
  )

  useEffect(() => {
    if (savedAccent) return
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
  }, [coverSampleUrl, savedAccent, mix?.id])

  if (!mix) {
    return (
      <section className="view">
        <header className="view__head view__head--row">
          <div>
            <h2>Daily Mix</h2>
            <p>This mix is no longer open.</p>
          </div>
          <div className="view__actions">
            <button type="button" className="hero__cta" onClick={clearDailyMix}>
              Back to Home
            </button>
          </div>
        </header>
      </section>
    )
  }

  const songLabel = `${tracks.length} song${tracks.length === 1 ? '' : 's'}`
  const lengthLabel = formatPlaylistLength(totalDurationMs)

  return (
    <section className="playlists-page">
      <header className="playlists-page__detail" style={bannerStyle}>
        <button type="button" className="playlists-page__back" onClick={clearDailyMix}>
          ← Home
        </button>

        <div className="playlists-page__detail-main">
          <div
            className={`playlists-page__cover${artKeys.length >= 4 ? ' is-collage' : ''}`}
            aria-hidden
          >
            {artKeys.length >= 4 ? (
              artKeys.slice(0, 4).map((key) => (
                <img key={key} src={artworkUrl(key) ?? undefined} alt="" />
              ))
            ) : artKeys[0] ? (
              <img src={artworkUrl(artKeys[0]) ?? undefined} alt="" />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: mix.accentColor,
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <Icon name="playlist" size={56} />
              </div>
            )}
          </div>

          <div className="playlists-page__info">
            <p className="playlists-page__kind">Daily Mix</p>
            <h1 className="playlists-page__title">{mix.title}</h1>
            {mix.subtitle ? <p className="playlists-page__desc">{mix.subtitle}</p> : null}
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
            aria-label={`Play ${mix.title}`}
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
          </div>
        </div>
      </header>

      <PlaylistTrackTable
        tracks={tracks}
        emptyMessage="This Daily Mix has no playable tracks right now."
      />
    </section>
  )
}
