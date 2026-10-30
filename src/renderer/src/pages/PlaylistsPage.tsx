import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  PlaylistAddTracksModal,
  PlaylistCoverThumb,
  PlaylistEditModal,
  PlaylistRecommended,
  PlaylistTrackTable,
  usePlaylists
} from '@renderer/features/playlists'
import { usePlayback } from '@renderer/features/player'
import { artworkUrl, formatDuration } from '@renderer/lib/format'
import {
  DEFAULT_PLAYLIST_ACCENT,
  extractAccentFromImageUrl,
  normalizeHexColor,
  playlistBannerStyle
} from '@renderer/lib/playlistAccent'
import { Icon } from '@renderer/components/ui/Icon'

function playlistTitle(name: string, systemKey: string | null): string {
  if (systemKey === 'liked' || name === 'Liked Songs') return 'Loved Songs'
  return name
}

function formatPlaylistLength(ms: number): string {
  if (!ms || ms <= 0) return ''
  const totalSec = Math.round(ms / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  if (hours > 0) return `${hours} hr ${minutes} min`
  return `${minutes} min ${seconds.toString().padStart(2, '0')} sec`
}

/** First up to 4 unique artwork keys in playlist order. */
function coverArtKeys(tracks: { artworkKey: string | null }[]): string[] {
  const keys: string[] = []
  for (const track of tracks) {
    if (track.artworkKey && !keys.includes(track.artworkKey)) keys.push(track.artworkKey)
    if (keys.length >= 4) break
  }
  return keys
}

/** Playlists hub — Spotify-style detail for offline playlists. */
export function PlaylistsPage(): React.JSX.Element {
  const {
    playlists,
    selectedPlaylist,
    selectedTracks,
    selectPlaylist,
    error,
    createPlaylist,
    renamePlaylist,
    setPlaylistDescription,
    setPlaylistCoverData,
    clearPlaylistCover,
    setPlaylistAccentColor,
    addTracks,
    editRequestId,
    clearEditRequest
  } = usePlaylists()
  const { playTrack, shuffle, toggleShuffle } = usePlayback()
  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [derivedAccent, setDerivedAccent] = useState(DEFAULT_PLAYLIST_ACCENT)

  const hubPlaylists = useMemo(() => {
    return [...playlists].sort((a, b) => {
      const aLiked = a.systemKey === 'liked' || a.name === 'Liked Songs' ? 0 : 1
      const bLiked = b.systemKey === 'liked' || b.name === 'Liked Songs' ? 0 : 1
      if (aLiked !== bLiked) return aLiked - bLiked
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
  }, [playlists])

  const artKeys = useMemo(() => {
    if (selectedPlaylist?.coverArtKeys?.length) return selectedPlaylist.coverArtKeys
    return coverArtKeys(selectedTracks)
  }, [selectedPlaylist?.coverArtKeys, selectedTracks])

  const customCover = selectedPlaylist?.coverKey ?? null
  const coverSampleUrl = useMemo(() => {
    if (customCover) return artworkUrl(customCover)
    if (artKeys[0]) return artworkUrl(artKeys[0])
    return null
  }, [customCover, artKeys])

  const savedAccent = normalizeHexColor(selectedPlaylist?.accentColor)
  const bannerAccent = savedAccent ?? derivedAccent
  const bannerStyle = useMemo(() => playlistBannerStyle(bannerAccent), [bannerAccent])

  const existingIds = useMemo(
    () => new Set(selectedTracks.map((track) => track.id)),
    [selectedTracks]
  )

  useEffect(() => {
    if (!editRequestId || selectedPlaylist?.id !== editRequestId) return
    setEditOpen(true)
    clearEditRequest()
  }, [editRequestId, selectedPlaylist?.id, clearEditRequest])

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
  }, [coverSampleUrl, savedAccent, selectedPlaylist?.id])

  if (!selectedPlaylist) {
    return (
      <section className="view">
        <header className="view__head view__head--row">
          <div>
            <h2>Playlists</h2>
            <p>
              {hubPlaylists.length} playlist{hubPlaylists.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="view__actions">
            <button type="button" className="hero__cta" onClick={() => void createPlaylist()}>
              New Playlist
            </button>
          </div>
        </header>
        {error ? <p className="hero__error">{error}</p> : null}
        {hubPlaylists.length === 0 ? (
          <p className="hero__error">No playlists yet. Create one to start a collection.</p>
        ) : (
          <div className="grid-cards">
            {hubPlaylists.map((playlist) => {
              const title = playlistTitle(playlist.name, playlist.systemKey)
              const songLabel = `${playlist.trackCount} song${
                playlist.trackCount === 1 ? '' : 's'
              }`
              return (
                <button
                  key={playlist.id}
                  type="button"
                  className="card card--button card--album"
                  onClick={() => selectPlaylist(playlist.id)}
                >
                  <div className="card__frame gold-frame">
                    <PlaylistCoverThumb playlist={playlist} fill />
                  </div>
                  <h3>{title}</h3>
                  <p>{songLabel}</p>
                </button>
              )
            })}
          </div>
        )}
      </section>
    )
  }

  const title = playlistTitle(selectedPlaylist.name, selectedPlaylist.systemKey)
  const isLoved =
    selectedPlaylist.systemKey === 'liked' || selectedPlaylist.name === 'Liked Songs'
  const lengthLabel = formatPlaylistLength(selectedPlaylist.totalDurationMs)
  const songLabel = `${selectedPlaylist.trackCount} song${selectedPlaylist.trackCount === 1 ? '' : 's'}`

  return (
    <section className="playlists-page">
      <header className="playlists-page__detail" style={bannerStyle}>
        <button
          type="button"
          className="playlists-page__back"
          onClick={() => selectPlaylist(null)}
        >
          ← All playlists
        </button>

        <div className="playlists-page__detail-main">
          <div
            className={`playlists-page__cover${
              isLoved
                ? ' is-loved'
                : !customCover && artKeys.length >= 4
                  ? ' is-collage'
                  : ''
            }`}
            aria-hidden
          >
            {isLoved ? (
              <span
                className="ug-candy-heart ug-candy-heart--art ug-candy-heart--art-plain"
                style={{ '--ug-candy-heart-size': '78px' } as CSSProperties}
              />
            ) : customCover ? (
              <img src={artworkUrl(customCover) ?? undefined} alt="" />
            ) : artKeys.length >= 4 ? (
              artKeys.map((key) => <img key={key} src={artworkUrl(key) ?? undefined} alt="" />)
            ) : artKeys[0] ? (
              <img src={artworkUrl(artKeys[0]) ?? undefined} alt="" />
            ) : (
              <Icon name="create-playlist" size={56} />
            )}
          </div>

          <div className="playlists-page__info">
            <p className="playlists-page__kind">
              {selectedPlaylist.isSystem ? 'System playlist' : 'Playlist'}
            </p>
            <h1 className="playlists-page__title">{title}</h1>
            {selectedPlaylist.description ? (
              <p className="playlists-page__desc">{selectedPlaylist.description}</p>
            ) : null}
            <p className="playlists-page__meta">
              <span>{songLabel}</span>
              {lengthLabel ? <span>· {lengthLabel}</span> : null}
              {selectedPlaylist.totalDurationMs > 0 ? (
                <span className="playlists-page__meta-faint">
                  ({formatDuration(selectedPlaylist.totalDurationMs)})
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="playlists-page__controls">
          <button
            type="button"
            className="playlists-page__play"
            disabled={selectedTracks.length === 0}
            aria-label={`Play ${title}`}
            data-no-groove-tip
            onClick={() => {
              if (selectedTracks[0]) playTrack(selectedTracks[0], selectedTracks)
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
              onClick={() => setAddOpen(true)}
            >
              <Icon name="add-to-playlist" size={14} />
              Add
            </button>
            <button
              type="button"
              className="playlists-page__pill"
              disabled={selectedTracks.length === 0}
              onClick={() => {
                const start =
                  selectedTracks[Math.floor(Math.random() * selectedTracks.length)]
                if (start) playTrack(start, selectedTracks, { forceShuffle: true })
              }}
            >
              <Icon name="shuffle" size={14} />
              Mix
            </button>
            <button
              type="button"
              className="playlists-page__pill"
              onClick={() => setEditOpen(true)}
            >
              <Icon name="edit" size={14} />
              Edit details
            </button>
          </div>
        </div>
      </header>

      <PlaylistTrackTable playlistId={selectedPlaylist.id} tracks={selectedTracks} />

      <PlaylistRecommended
        playlistId={selectedPlaylist.id}
        seedKey={`${selectedPlaylist.id}:${selectedTracks.map((track) => track.id).join(',')}`}
        hasSeeds={selectedTracks.length > 0}
      />

      <PlaylistEditModal
        open={editOpen}
        playlist={selectedPlaylist}
        tracks={selectedTracks}
        previewAccent={bannerAccent}
        onClose={() => setEditOpen(false)}
        onCoverFile={(data, mime) => setPlaylistCoverData(selectedPlaylist.id, data, mime)}
        onClearCover={() => clearPlaylistCover(selectedPlaylist.id)}
        onSave={async (name, description, accentColor) => {
          if (!selectedPlaylist.isSystem && name !== selectedPlaylist.name) {
            await renamePlaylist(selectedPlaylist.id, name)
          }
          if (description !== selectedPlaylist.description) {
            await setPlaylistDescription(selectedPlaylist.id, description)
          }
          const nextAccent = accentColor
          const prevAccent = selectedPlaylist.accentColor ?? null
          if (nextAccent !== prevAccent) {
            await setPlaylistAccentColor(selectedPlaylist.id, nextAccent)
          }
        }}
      />

      <PlaylistAddTracksModal
        open={addOpen}
        playlistName={title}
        existingTrackIds={existingIds}
        onClose={() => setAddOpen(false)}
        onAdd={async (trackIds) => {
          await addTracks(selectedPlaylist.id, trackIds)
        }}
      />
    </section>
  )
}
