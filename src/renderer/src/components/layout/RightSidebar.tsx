import { useEffect, useState } from 'react'
import type { ArtistSpotlight, RelatedTracksResult, TrackRow } from '@shared/types'
import { LyricsPanel } from '@renderer/features/lyrics'
import { useLibrary } from '@renderer/features/library'
import { usePlaylists } from '@renderer/features/playlists/hooks/usePlaylists'
import { QueuePanel, usePlayback } from '@renderer/features/player'
import { useSettings } from '@renderer/features/settings'
import { artworkUrl } from '@renderer/lib/format'
import { CandyScroll } from '../ui/CandyScroll'
import { GalaxySky } from '../ui/GalaxySky'
import { Icon } from '../ui/Icon'
import './RightSidebar.css'

export type RightTabId = 'lyrics' | 'about' | 'related' | 'queue'

type RightSidebarProps = {
  tab: RightTabId
  onTabChange: (tab: RightTabId) => void
  /** Leave queue mode and restore the previous right-rail tab. */
  onLeaveQueue?: () => void
  /** Bumps when the footer title asks to spotlight this panel. */
  revealTick?: number
}

function RelatedList({
  title,
  tracks,
  onPlayNext,
  onQueue
}: {
  title: string
  tracks: TrackRow[]
  onPlayNext: (track: TrackRow) => void
  onQueue: (track: TrackRow) => void
}): React.JSX.Element | null {
  if (tracks.length === 0) return null
  return (
    <div className="related-block">
      <h3>{title}</h3>
      <ul className="related">
        {tracks.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.artistName}</span>
            </div>
            <button
              type="button"
              aria-label={`Play ${item.title} next`}
              onClick={() => onPlayNext(item)}
              title="Play next"
            >
              <Icon name="next" size={16} />
            </button>
            <button
              type="button"
              aria-label={`Add ${item.title} to queue`}
              onClick={() => onQueue(item)}
              title="Add to queue"
            >
              <Icon name="plus" size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function RightSidebar({
  tab,
  onTabChange,
  onLeaveQueue,
  revealTick = 0
}: RightSidebarProps): React.JSX.Element {
  const { currentTrack, focusedTrack, playNext, addToQueue, playTrack } = usePlayback()
  const { selectAlbum, selectArtist, setActiveNav } = useLibrary()
  const { toggleLiked, isLiked } = usePlaylists()
  const { settings } = useSettings()
  const track = focusedTrack ?? currentTrack
  const liked = track ? isLiked(track.id) : false
  const galaxyChrome = settings.appearance.galaxyChrome !== false

  const [related, setRelated] = useState<RelatedTracksResult | null>(null)
  const [spotlight, setSpotlight] = useState<ArtistSpotlight | null>(null)
  const [lit, setLit] = useState(false)

  useEffect(() => {
    if (!revealTick) return
    setLit(true)
    const timer = window.setTimeout(() => setLit(false), 900)
    return () => window.clearTimeout(timer)
  }, [revealTick])

  useEffect(() => {
    let cancelled = false
    if (!track || !window.api?.library?.getRelatedTracks) {
      setRelated(null)
      setSpotlight(null)
      return
    }
    void Promise.all([
      window.api.library.getRelatedTracks(track.id, 8),
      window.api.library.getArtistSpotlight(track.artistId, track.artistName)
    ]).then(([nextRelated, nextSpotlight]) => {
      if (cancelled) return
      setRelated(nextRelated)
      setSpotlight(nextSpotlight)
    })
    return () => {
      cancelled = true
    }
  }, [track?.id, track?.artistId, track?.artistName])

  const openArtist = (): void => {
    if (!track?.artistId) return
    selectArtist(track.artistId)
    setActiveNav('artists')
  }

  const openAlbum = (): void => {
    if (!track?.albumId) return
    selectAlbum(track.albumId)
    setActiveNav('albums')
  }

  if (tab === 'queue') {
    return (
      <aside
        className={`right-sidebar gold-frame right-sidebar--queue${lit ? ' is-lit' : ''}`}
        aria-label="Play queue"
      >
        {galaxyChrome ? <GalaxySky variant="chrome" seed={73} /> : null}
        <CandyScroll className="right-sidebar__queue-scroll" label="Scroll queue">
          <QueuePanel
            embedded
            onClose={() => {
              onLeaveQueue?.()
            }}
          />
        </CandyScroll>
      </aside>
    )
  }

  return (
    <aside
      className={`right-sidebar gold-frame${lit ? ' is-lit' : ''}`}
      aria-label="Now playing"
    >
      {galaxyChrome ? <GalaxySky variant="chrome" seed={73} /> : null}
      <div className="right-sidebar__art gold-frame">
        <div className="right-sidebar__art-inner" aria-hidden>
          {track && artworkUrl(track.artworkKey) ? (
            <img src={artworkUrl(track.artworkKey) ?? undefined} alt="" />
          ) : (
            <div className="right-sidebar__art-fallback">
              <span>{track?.title?.slice(0, 1) ?? '♪'}</span>
              <Icon name="moon" />
            </div>
          )}
        </div>
      </div>

      <div className="right-sidebar__meta">
        <div>
          <h2>{track?.title ?? 'Nothing playing'}</h2>
          <p>
            {track ? (
              <button type="button" className="right-sidebar__link" onClick={openArtist}>
                {track.artistName}
              </button>
            ) : (
              'Play a track from your library'
            )}
          </p>
        </div>
        <button
          type="button"
          className={`right-sidebar__icon ug-candy-heart${liked ? ' is-liked' : ''}`}
          aria-label={liked ? 'Unlove' : 'Love'}
          disabled={!track}
          onClick={() => {
            if (track) void toggleLiked(track.id)
          }}
        >
          <Icon name="heart" size={22} />
        </button>
      </div>

      <div className="right-sidebar__tabs" role="tablist" aria-label="Track details">
        {(
          [
            ['lyrics', 'Lyrics'],
            ['about', 'About'],
            ['related', 'Related']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`right-sidebar__tab${tab === id ? ' is-active' : ''}`}
            onClick={() => onTabChange(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <CandyScroll className="right-sidebar__body" label="Scroll details" role="tabpanel">
        {/* Remount lyrics when leaving this tab so sync work stops and play is required again. */}
        {tab === 'lyrics' ? (
          <div className="lyrics-rail" key="lyrics-rail">
            <LyricsPanel variant="sidebar" />
          </div>
        ) : null}

        {tab === 'about' && (
          <div className="about">
            {track ? (
              <>
                <p>
                  Album:{' '}
                  <button type="button" className="right-sidebar__link" onClick={openAlbum}>
                    <strong>{track.albumTitle}</strong>
                  </button>
                </p>
                {track.year ? (
                  <p>
                    Year: <strong>{track.year}</strong>
                  </p>
                ) : null}
                {track.genre ? (
                  <p>
                    Genre: <strong>{track.genre}</strong>
                  </p>
                ) : null}
                {track.codec ? (
                  <p>
                    Format: <strong>{track.codec}</strong>
                    {track.bitrate ? ` · ${Math.round(track.bitrate / 1000)} kbps` : ''}
                  </p>
                ) : null}

                {spotlight && spotlight.trackCount > 0 ? (
                  <div className="about__artist">
                    <h3>From your library</h3>
                    <p>
                      <strong>{spotlight.name}</strong> — {spotlight.trackCount} songs ·{' '}
                      {spotlight.albumCount} albums
                    </p>
                    {spotlight.albums.length > 0 ? (
                      <ul className="about__albums">
                        {spotlight.albums.slice(0, 5).map((album) => (
                          <li key={album.id}>
                            <button
                              type="button"
                              onClick={() => {
                                selectAlbum(album.id)
                                setActiveNav('albums')
                              }}
                            >
                              {album.title}
                              {album.year ? ` (${album.year})` : ''}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {spotlight.topTracks[0] ? (
                      <button
                        type="button"
                        className="about__play-artist"
                        onClick={() => playTrack(spotlight.topTracks[0], spotlight.topTracks)}
                      >
                        Play artist tracks
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="about__empty">
                Click a song to inspect it here, or double-click / use play to start listening.
              </p>
            )}
          </div>
        )}

        {tab === 'related' && (
          <div className="related-wrap">
            {!track && (
              <p className="about__empty">Click a song to find related local tracks.</p>
            )}
            {track && related && (
              <>
                <RelatedList
                  title="Same artist"
                  tracks={related.sameArtist}
                  onPlayNext={playNext}
                  onQueue={addToQueue}
                />
                <RelatedList
                  title="Same album"
                  tracks={related.sameAlbum}
                  onPlayNext={playNext}
                  onQueue={addToQueue}
                />
                <RelatedList
                  title="Same genre"
                  tracks={related.sameGenre}
                  onPlayNext={playNext}
                  onQueue={addToQueue}
                />
                {related.sameArtist.length === 0 &&
                  related.sameAlbum.length === 0 &&
                  related.sameGenre.length === 0 && (
                    <p className="about__empty">
                      No other local matches yet. Add more music from this artist or genre.
                    </p>
                  )}
              </>
            )}
          </div>
        )}
      </CandyScroll>
    </aside>
  )
}
