import { useCallback, useEffect, useState } from 'react'
import type { HomePersonalization, LocalMix, PlayedTrackRow, TrackRow } from '@shared/types'
import { PLATO_QUOTE } from '@renderer/app/navigation'
import { CoverArt, useLibrary } from '@renderer/features/library'
import { usePlayback } from '@renderer/features/player'
import { artworkUrl } from '@renderer/lib/format'
import { BrowseTabs } from '@renderer/components/ui/BrowseTabs'
import { GalaxySky } from '@renderer/components/ui/GalaxySky'
import { Icon } from '@renderer/components/ui/Icon'
import { RailScroller } from '@renderer/components/ui/RailScroller'
import { openSettings } from '@renderer/lib/settingsNav'

const emptyHome: HomePersonalization = {
  jumpBackIn: [],
  mostPlayed: [],
  onRepeat: [],
  dailyMixes: [],
  mixesGeneratedAt: null
}

type HomeTabId = 'home' | 'jump' | 'repeat' | 'most' | 'mixes' | 'fresh'

const HOME_TABS: { id: HomeTabId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'jump', label: 'Jump Back In' },
  { id: 'repeat', label: 'On Repeat' },
  { id: 'most', label: 'Most Played' },
  { id: 'mixes', label: 'Daily Mixes' },
  { id: 'fresh', label: 'Fresh Finds' }
]

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

/** Home dashboard — welcome, listening rails + local daily mixes. */
export function HomePage(): React.JSX.Element {
  const {
    summary,
    albums,
    recentTracks,
    ready,
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
  const [tab, setTab] = useState<HomeTabId>('home')

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

  const openTrackAlbum = (track: TrackRow): void => {
    if (!track.albumId) return
    selectAlbum(track.albumId)
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

  const hour = new Date().getHours()
  const greeting =
    hour < 5 ? 'Still spinning after midnight' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <section className="hero gold-frame" aria-label="Welcome">
        <div className="hero__cosmos" aria-hidden>
          <GalaxySky variant="hero" seed={0} />
          <span className="hero__orb hero__orb--a" />
          <span className="hero__orb hero__orb--b" />
          <span className="hero__orb hero__orb--c" />
          <span className="hero__ring" />
        </div>
        <div className="hero__veil" />
        <div className="hero__content">
          <div className="hero__intro">
            <p className="hero__eyebrow">{greeting}</p>
            <h1 className="hero__welcome">
              <span className="hero__welcome-line">Welcome back to</span>
              <span className="hero__brand">Umbrix Groove</span>
            </h1>
            <p className="hero__tagline">
              All of your music in one place and not on a shitty paid service.
            </p>
          </div>
          <div className="hero__foot">
            <div className="hero__actions">
              <button
                type="button"
                className="hero__cta"
                disabled={scanning}
                onClick={() => openSettings({ focus: 'add-folder' })}
              >
                <span>Add Music Folder</span>
              </button>
              <button
                type="button"
                className="hero__cta hero__cta--ghost"
                disabled={scanning}
                onClick={() => void importFiles()}
              >
                <span>Import Files</span>
              </button>
            </div>
            {error ? <p className="hero__error">{error}</p> : null}
            <p className="hero__stats">
              {ready
                ? `${summary.trackCount.toLocaleString()} songs · ${summary.albumCount.toLocaleString()} albums · ${summary.artistCount.toLocaleString()} artists · ${summary.folderCount} folders`
                : 'Loading library…'}
              {summary.incompleteCount > 0
                ? ` · ${summary.incompleteCount} with incomplete tags`
                : ''}
            </p>
          </div>
        </div>
        <blockquote className="hero__quote">
          <p>“{PLATO_QUOTE}”</p>
          <cite>— Plato</cite>
        </blockquote>
      </section>

      {summary.trackCount === 0 && !scanning ? (
        <section className="placeholder gold-frame">
          <h2>No local music indexed yet</h2>
          <p>Point Umbrix Groove at a folder on this PC.</p>
          <button
            type="button"
            className="hero__cta"
            onClick={() => openSettings({ focus: 'add-folder' })}
          >
            Add Folder
          </button>
        </section>
      ) : (
        <>
          <BrowseTabs
            label="Home sections"
            tabs={HOME_TABS}
            active={tab}
            onChange={setTab}
          />

          {tab === 'home' ? (
            <HomeOverview
              home={home}
              homeReady={homeReady}
              mixNote={mixNote}
              refreshingMixes={refreshingMixes}
              recentTracks={recentTracks}
              albums={albums}
              albumCount={summary.albumCount}
              onRefreshMixes={() => void refreshMixes()}
              onOpenMix={openDailyMix}
              onPlay={(track, list) => playTrack(track, list)}
              onOpenTrack={openTrackAlbum}
              onOpenAlbum={selectAlbum}
              onShowTab={setTab}
            />
          ) : null}

          {tab === 'jump' ? (
            <ShelfPage
              title="Jump Back In"
              note="Pick up where you left off"
              emptyTitle="Nothing to jump into yet"
              emptyBody="Play a few tracks and they will land here for a quick restart."
              tracks={home.jumpBackIn}
              meta={(t) => t.artistName}
              onPlay={(track, list) => playTrack(track, list)}
              onOpen={openTrackAlbum}
            />
          ) : null}

          {tab === 'repeat' ? (
            <ShelfPage
              title="On Repeat"
              note="Heavy rotation · last 14 days"
              emptyTitle="No obsession yet"
              emptyBody="Hammer a song for a bit and Umbrix will catch the habit."
              tracks={home.onRepeat}
              meta={(t) =>
                `${t.recentPlayCount ?? t.playCount} plays recently · ${t.artistName}`
              }
              onPlay={(track, list) => playTrack(track, list)}
              onOpen={openTrackAlbum}
            />
          ) : null}

          {tab === 'most' ? (
            <ShelfPage
              title="Most Played"
              note="All-time favorites from this library"
              emptyTitle="Play history starts now"
              emptyBody="Finish a song (or listen 30+ seconds then skip) and the crown jewels show up here."
              tracks={home.mostPlayed}
              meta={(t) => `${t.playCount} play${t.playCount === 1 ? '' : 's'} · ${t.artistName}`}
              onPlay={(track, list) => playTrack(track, list)}
              onOpen={openTrackAlbum}
            />
          ) : null}

          {tab === 'mixes' ? (
            <MixesPage
              mixes={home.dailyMixes}
              homeReady={homeReady}
              mixNote={mixNote}
              refreshing={refreshingMixes}
              onRefresh={() => void refreshMixes()}
              onOpen={openDailyMix}
            />
          ) : null}

          {tab === 'fresh' ? (
            <FreshPage
              tracks={recentTracks}
              onPlay={(track, list) => playTrack(track, list)}
              onOpen={openTrackAlbum}
            />
          ) : null}
        </>
      )}
    </>
  )
}

function HomeOverview({
  home,
  homeReady,
  mixNote,
  refreshingMixes,
  recentTracks,
  albums,
  albumCount,
  onRefreshMixes,
  onOpenMix,
  onPlay,
  onOpenTrack,
  onOpenAlbum,
  onShowTab
}: {
  home: HomePersonalization
  homeReady: boolean
  mixNote: string
  refreshingMixes: boolean
  recentTracks: TrackRow[]
  albums: { id: string; title: string; artistName: string; artworkKey: string | null; trackCount?: number }[]
  albumCount: number
  onRefreshMixes: () => void
  onOpenMix: (mix: LocalMix) => void
  onPlay: (track: PlayedTrackRow | TrackRow, list: Array<PlayedTrackRow | TrackRow>) => void
  onOpenTrack: (track: TrackRow) => void
  onOpenAlbum: (id: string) => void
  onShowTab: (tab: HomeTabId) => void
}): React.JSX.Element {
  return (
    <>
      {home.dailyMixes.length > 0 ? (
        <section className="rail" aria-labelledby="mixes-heading">
          <div className="rail__head">
            <h2 id="mixes-heading">Daily Mixes</h2>
            <div className="rail__head-actions">
              <span>{mixNote}</span>
              <button type="button" className="rail__link" onClick={() => onShowTab('mixes')}>
                See all
              </button>
              <button
                type="button"
                className="rail__link"
                disabled={refreshingMixes}
                onClick={onRefreshMixes}
              >
                {refreshingMixes ? 'Building…' : 'Refresh now'}
              </button>
            </div>
          </div>
          <RailScroller rowClassName="rail__row--mixes" label="Daily Mixes">
            {home.dailyMixes.map((mix) => (
              <button
                key={mix.id}
                type="button"
                className="mix-card"
                onClick={() => onOpenMix(mix)}
                onDoubleClick={() => onOpenMix(mix)}
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
          </RailScroller>
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
            onClick={onRefreshMixes}
          >
            Try building mixes
          </button>
        </section>
      ) : null}

      {home.jumpBackIn.length > 0 ? (
        <PlayedRail
          id="jump-heading"
          title="Jump Back In"
          note="Recently played"
          tracks={home.jumpBackIn}
          meta={(t) => t.artistName}
          onPlay={onPlay}
          onOpen={onOpenTrack}
          onSeeAll={() => onShowTab('jump')}
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
          onPlay={onPlay}
          onOpen={onOpenTrack}
          onSeeAll={() => onShowTab('repeat')}
        />
      ) : null}

      {home.mostPlayed.length > 0 ? (
        <PlayedRail
          id="most-heading"
          title="Most Played"
          note="All-time from this library"
          tracks={home.mostPlayed}
          meta={(t) => `${t.playCount} play${t.playCount === 1 ? '' : 's'} · ${t.artistName}`}
          onPlay={onPlay}
          onOpen={onOpenTrack}
          onSeeAll={() => onShowTab('most')}
        />
      ) : homeReady ? (
        <section className="placeholder gold-frame home-hint">
          <h2>Play history starts now</h2>
          <p>
            Finish a song (or listen 30+ seconds then skip) and Umbrix will fill Most Played, On
            Repeat, and Jump Back In.
          </p>
        </section>
      ) : null}

      <section className="rail" aria-labelledby="recent-heading">
        <div className="rail__head">
          <h2 id="recent-heading">Recently Added</h2>
          <div className="rail__head-actions">
            <span>From your library</span>
            <button type="button" className="rail__link" onClick={() => onShowTab('fresh')}>
              See all
            </button>
          </div>
        </div>
        <RailScroller label="Recently Added">
          {recentTracks.map((track) => (
            <button
              key={track.id}
              type="button"
              className="card card--button"
              onClick={() => onPlay(track, recentTracks)}
              onDoubleClick={() => onOpenTrack(track)}
            >
              <CoverArt title={track.title} artworkKey={track.artworkKey} />
              <h3>{track.title}</h3>
              <p>{track.artistName}</p>
            </button>
          ))}
        </RailScroller>
      </section>

      <section className="rail" aria-labelledby="albums-heading">
        <div className="rail__head">
          <h2 id="albums-heading">Albums</h2>
          <span>{albumCount} in library</span>
        </div>
        <RailScroller label="Albums">
          {albums.slice(0, 12).map((album) => (
            <button
              key={album.id}
              type="button"
              className="card card--button"
              onClick={() => onOpenAlbum(album.id)}
              onDoubleClick={() => onOpenAlbum(album.id)}
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
        </RailScroller>
      </section>
    </>
  )
}

function PlayedRail({
  id,
  title,
  note,
  tracks,
  meta,
  onPlay,
  onOpen,
  onSeeAll
}: {
  id: string
  title: string
  note: string
  tracks: PlayedTrackRow[]
  meta: (track: PlayedTrackRow) => string
  onPlay: (track: PlayedTrackRow, tracks: PlayedTrackRow[]) => void
  onOpen: (track: PlayedTrackRow) => void
  onSeeAll?: () => void
}): React.JSX.Element {
  return (
    <section className="rail" aria-labelledby={id}>
      <div className="rail__head">
        <h2 id={id}>{title}</h2>
        <div className="rail__head-actions">
          <span>{note}</span>
          {onSeeAll ? (
            <button type="button" className="rail__link" onClick={onSeeAll}>
              See all
            </button>
          ) : null}
        </div>
      </div>
      <RailScroller label={title}>
        {tracks.map((track) => (
          <button
            key={track.id}
            type="button"
            className="card card--button"
            onClick={() => onPlay(track, tracks)}
            onDoubleClick={() => onOpen(track)}
          >
            <CoverArt title={track.title} artworkKey={track.artworkKey} />
            <h3>{track.title}</h3>
            <p>{meta(track)}</p>
          </button>
        ))}
      </RailScroller>
    </section>
  )
}

function ShelfPage({
  title,
  note,
  emptyTitle,
  emptyBody,
  tracks,
  meta,
  onPlay,
  onOpen
}: {
  title: string
  note: string
  emptyTitle: string
  emptyBody: string
  tracks: PlayedTrackRow[]
  meta: (track: PlayedTrackRow) => string
  onPlay: (track: PlayedTrackRow, tracks: PlayedTrackRow[]) => void
  onOpen: (track: PlayedTrackRow) => void
}): React.JSX.Element {
  if (tracks.length === 0) {
    return (
      <section className="placeholder gold-frame home-hint">
        <h2>{emptyTitle}</h2>
        <p>{emptyBody}</p>
      </section>
    )
  }

  return (
    <section className="home-shelf" aria-label={title}>
      <div className="home-shelf__head">
        <div>
          <h2>{title}</h2>
          <p>{note}</p>
        </div>
        <button
          type="button"
          className="hero__cta"
          onClick={() => onPlay(tracks[0], tracks)}
        >
          Play all
        </button>
      </div>
      <div className="home-shelf__grid">
        {tracks.map((track, index) => (
          <button
            key={track.id}
            type="button"
            className="home-shelf__card"
            onClick={() => onPlay(track, tracks)}
            onDoubleClick={() => onOpen(track)}
          >
            <span className="home-shelf__rank" aria-hidden>
              {index + 1}
            </span>
            <CoverArt title={track.title} artworkKey={track.artworkKey} />
            <span className="home-shelf__copy">
              <strong>{track.title}</strong>
              <span>{meta(track)}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function MixesPage({
  mixes,
  homeReady,
  mixNote,
  refreshing,
  onRefresh,
  onOpen
}: {
  mixes: LocalMix[]
  homeReady: boolean
  mixNote: string
  refreshing: boolean
  onRefresh: () => void
  onOpen: (mix: LocalMix) => void
}): React.JSX.Element {
  if (mixes.length === 0) {
    return (
      <section className="placeholder gold-frame home-hint">
        <h2>{homeReady ? 'Daily Mixes need tags' : 'Building mixes…'}</h2>
        <p>
          Umbrix builds mixes like “1990s Hip Hop” from year + genre on your files. Add more tagged
          tracks, or hit Refresh after a rescan.
        </p>
        <button
          type="button"
          className="hero__cta hero__cta--ghost"
          disabled={refreshing}
          onClick={onRefresh}
        >
          {refreshing ? 'Building…' : 'Try building mixes'}
        </button>
      </section>
    )
  }

  return (
    <section className="home-shelf" aria-label="Daily Mixes">
      <div className="home-shelf__head">
        <div>
          <h2>Daily Mixes</h2>
          <p>{mixNote}</p>
        </div>
        <button
          type="button"
          className="hero__cta hero__cta--ghost"
          disabled={refreshing}
          onClick={onRefresh}
        >
          {refreshing ? 'Building…' : 'Refresh now'}
        </button>
      </div>
      <div className="home-shelf__mix-grid">
        {mixes.map((mix) => (
          <button
            key={mix.id}
            type="button"
            className="mix-card"
            onClick={() => onOpen(mix)}
            onDoubleClick={() => onOpen(mix)}
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
  )
}

function FreshPage({
  tracks,
  onPlay,
  onOpen
}: {
  tracks: TrackRow[]
  onPlay: (track: TrackRow, list: TrackRow[]) => void
  onOpen: (track: TrackRow) => void
}): React.JSX.Element {
  if (tracks.length === 0) {
    return (
      <section className="placeholder gold-frame home-hint">
        <h2>No fresh finds yet</h2>
        <p>Import or scan a folder and new arrivals will show up here.</p>
      </section>
    )
  }

  return (
    <section className="home-shelf" aria-label="Fresh Finds">
      <div className="home-shelf__head">
        <div>
          <h2>Fresh Finds</h2>
          <p>Recently added to your library</p>
        </div>
        <button type="button" className="hero__cta" onClick={() => onPlay(tracks[0], tracks)}>
          Play all
        </button>
      </div>
      <div className="home-shelf__grid">
        {tracks.map((track) => (
          <button
            key={track.id}
            type="button"
            className="home-shelf__card"
            onClick={() => onPlay(track, tracks)}
            onDoubleClick={() => onOpen(track)}
          >
            <CoverArt title={track.title} artworkKey={track.artworkKey} />
            <span className="home-shelf__copy">
              <strong>{track.title}</strong>
              <span>{track.artistName}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
