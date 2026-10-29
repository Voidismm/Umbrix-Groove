import { useCallback, useEffect, useState } from 'react'
import type { HomePersonalization, LocalMix, PlayedTrackRow, TrackRow } from '@shared/types'
import { PLATO_QUOTE } from '@renderer/app/navigation'
import { CoverArt, useLibrary } from '@renderer/features/library'
import { usePlayback } from '@renderer/features/player'
import { artworkUrl } from '@renderer/lib/format'
import { Icon } from '@renderer/components/ui/Icon'

const emptyHome: HomePersonalization = {
  jumpBackIn: [],
  mostPlayed: [],
  onRepeat: [],
  dailyMixes: [],
  mixesGeneratedAt: null
}

function MixCover({ mix }: { mix: LocalMix }): React.JSX.Element {
  const keys = mix.coverArtKeys
  if (keys.length >= 4) {
    return (
      <div className="mix-card__art mix-card__art--collage" aria-hidden>
        {keys.slice(0, 4).map((key) => (
          <img key={key} src={artworkUrl(key) ?? undefined} alt="" />
        ))}
      </div>
    )
  }
  if (keys[0]) {
    return (
      <div className="mix-card__art" aria-hidden>
        <img src={artworkUrl(keys[0]) ?? undefined} alt="" />
      </div>
    )
  }
  return (
    <div
      className="mix-card__art mix-card__art--fallback"
      style={{ background: mix.accentColor }}
      aria-hidden
    >
      <Icon name="playlist" size={36} />
    </div>
  )
}

/** Home dashboard — listening rails + local daily mixes. */
export function HomePage(): React.JSX.Element {
  const {
    summary,
    albums,
    recentTracks,
    ready,
    addFolder,
    importFiles,
    selectAlbum,
    openDailyMix,
    scanning,
    error
  } = useLibrary()
  const { playTrack } = usePlayback()
  const [home, setHome] = useState<HomePersonalization>(emptyHome)
  const [homeReady, setHomeReady] = useState(false)
  const [refreshingMixes, setRefreshingMixes] = useState(false)

  const loadHome = useCallback(async (): Promise<void> => {
    if (!window.api?.library?.getHomePersonalization) {
      setHomeReady(true)
      return
    }
    try {
      const next = await window.api.library.getHomePersonalization()
      setHome(next)
    } catch {
      setHome(emptyHome)
    } finally {
      setHomeReady(true)
    }
  }, [])

  useEffect(() => {
    void loadHome()
  }, [loadHome, summary.trackCount])

  const playList = (tracks: TrackRow[]): void => {
    if (tracks[0]) playTrack(tracks[0], tracks)
  }

  const refreshMixes = async (): Promise<void> => {
    if (!window.api?.library?.getDailyMixes) return
    setRefreshingMixes(true)
    try {
      const mixes = await window.api.library.getDailyMixes(true)
      setHome((prev) => ({
        ...prev,
        dailyMixes: mixes,
        mixesGeneratedAt: mixes[0]?.generatedAt ?? null
      }))
    } finally {
      setRefreshingMixes(false)
    }
  }

  const mixNote = home.mixesGeneratedAt
    ? `Refreshes daily · last built ${new Date(home.mixesGeneratedAt).toLocaleString()}`
    : 'Built from decades + genres in your library'

  return (
    <>
      <section className="hero gold-frame" aria-label="Welcome">
        <div className="hero__veil" />
        <div className="hero__content">
          <h1 className="hero__welcome">
            Welcome back to <span className="hero__brand">Umbrix Groove</span>
          </h1>
          <div className="hero__actions">
            <button
              type="button"
              className="hero__cta"
              disabled={scanning}
              onClick={() => void addFolder()}
            >
              Add Music Folder
            </button>
            <button
              type="button"
              className="hero__cta hero__cta--ghost"
              disabled={scanning}
              onClick={() => void importFiles()}
            >
              Import Files
            </button>
          </div>
          {error ? <p className="hero__error">{error}</p> : null}
          <p className="hero__stats">
            {ready
              ? `${summary.trackCount} songs · ${summary.albumCount} albums · ${summary.artistCount} artists · ${summary.folderCount} folders`
              : 'Loading library…'}
            {summary.incompleteCount > 0
              ? ` · ${summary.incompleteCount} with incomplete tags`
              : ''}
          </p>
        </div>
        <blockquote className="hero__quote">
          <p>“{PLATO_QUOTE}”</p>
          <cite>— Plato</cite>
        </blockquote>
      </section>

      {summary.trackCount === 0 && !scanning ? (
        <section className="placeholder gold-frame">
          <h2>No local music indexed yet</h2>
          <p>
            Point Umbrix Groove at a folder on this PC. Files stay where they are — we only read
            tags and build a searchable index.
          </p>
        </section>
      ) : (
        <>
          {home.dailyMixes.length > 0 ? (
            <section className="rail" aria-labelledby="mixes-heading">
              <div className="rail__head">
                <h2 id="mixes-heading">Daily Mixes</h2>
                <div className="rail__head-actions">
                  <span>{mixNote}</span>
                  <button
                    type="button"
                    className="rail__link"
                    disabled={refreshingMixes}
                    onClick={() => void refreshMixes()}
                  >
                    {refreshingMixes ? 'Building…' : 'Refresh now'}
                  </button>
                </div>
              </div>
              <div className="rail__row rail__row--mixes">
                {home.dailyMixes.map((mix) => (
                  <button
                    key={mix.id}
                    type="button"
                    className="mix-card"
                    onClick={() => openDailyMix(mix)}
                  >
                    <div className="mix-card__frame">
                      <MixCover mix={mix} />
                      <span
                        className="mix-card__accent"
                        style={{ background: mix.accentColor }}
                        aria-hidden
                      />
                    </div>
                    <div className="mix-card__copy">
                      <h3>{mix.title}</h3>
                      <p>
                        {mix.trackCount} song{mix.trackCount === 1 ? '' : 's'}
                        {mix.subtitle ? ` · ${mix.subtitle}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : homeReady ? (
            <section className="placeholder gold-frame home-hint">
              <h2>Daily Mixes need tags</h2>
              <p>
                Umbrix builds mixes like “1990s Hip Hop” from year + genre on your files. Add more
                tagged tracks, or hit Refresh after a rescan.
              </p>
              <button
                type="button"
                className="hero__cta hero__cta--ghost"
                disabled={refreshingMixes}
                onClick={() => void refreshMixes()}
              >
                Try building mixes
              </button>
            </section>
          ) : null}

          {home.jumpBackIn.length > 0 ? (
            <PlayedRail
              id="jump-heading"
              title="Jump back in"
              note="Recently played"
              tracks={home.jumpBackIn}
              meta={(t) => t.artistName}
              onPlay={playList}
            />
          ) : null}

          {home.onRepeat.length > 0 ? (
            <PlayedRail
              id="repeat-heading"
              title="On Repeat"
              note="Heavy rotation · last 14 days"
              tracks={home.onRepeat}
              meta={(t) =>
                `${t.recentPlayCount ?? t.playCount} plays recently · ${t.artistName}`
              }
              onPlay={playList}
            />
          ) : null}

          {home.mostPlayed.length > 0 ? (
            <PlayedRail
              id="most-heading"
              title="Most Played"
              note="All-time from this library"
              tracks={home.mostPlayed}
              meta={(t) => `${t.playCount} play${t.playCount === 1 ? '' : 's'} · ${t.artistName}`}
              onPlay={playList}
            />
          ) : homeReady ? (
            <section className="placeholder gold-frame home-hint">
              <h2>Play history starts now</h2>
              <p>
                Finish a song (or listen 30+ seconds then skip) and Umbrix will fill Most Played,
                On Repeat, and Jump back in.
              </p>
            </section>
          ) : null}

          <section className="rail" aria-labelledby="recent-heading">
            <div className="rail__head">
              <h2 id="recent-heading">Recently Added</h2>
              <span>From your library</span>
            </div>
            <div className="rail__row">
              {recentTracks.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  className="card card--button"
                  onClick={() => playTrack(track, recentTracks)}
                >
                  <CoverArt title={track.title} artworkKey={track.artworkKey} />
                  <h3>{track.title}</h3>
                  <p>{track.artistName}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="rail" aria-labelledby="albums-heading">
            <div className="rail__head">
              <h2 id="albums-heading">Albums</h2>
              <span>{summary.albumCount} in library</span>
            </div>
            <div className="rail__row">
              {albums.slice(0, 12).map((album) => (
                <button
                  key={album.id}
                  type="button"
                  className="card card--button"
                  onClick={() => selectAlbum(album.id)}
                >
                  <div className="card__frame gold-frame">
                    <CoverArt title={album.title} artworkKey={album.artworkKey} tone="dusk" />
                  </div>
                  <h3>{album.title}</h3>
                  <p>
                    {album.artistName}
                    {album.trackCount ? ` · ${album.trackCount}` : ''}
                  </p>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  )
}

function PlayedRail({
  id,
  title,
  note,
  tracks,
  meta,
  onPlay
}: {
  id: string
  title: string
  note: string
  tracks: PlayedTrackRow[]
  meta: (track: PlayedTrackRow) => string
  onPlay: (tracks: TrackRow[]) => void
}): React.JSX.Element {
  return (
    <section className="rail" aria-labelledby={id}>
      <div className="rail__head">
        <h2 id={id}>{title}</h2>
        <span>{note}</span>
      </div>
      <div className="rail__row">
        {tracks.map((track) => (
          <button
            key={track.id}
            type="button"
            className="card card--button"
            onClick={() => onPlay(tracks)}
          >
            <CoverArt title={track.title} artworkKey={track.artworkKey} />
            <h3>{track.title}</h3>
            <p>{meta(track)}</p>
          </button>
        ))}
      </div>
    </section>
  )
}
