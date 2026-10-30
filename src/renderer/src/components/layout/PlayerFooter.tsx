import { useEffect, useRef, useState } from 'react'
import type { TrackRow } from '@shared/types'
import { TrackEditModal, useLibrary } from '@renderer/features/library'
import { usePlayback, usePlaybackClock, usePlaybackVolume } from '@renderer/features/player'
import { TrackContextMenu } from '@renderer/features/playlists'
import { usePlaylists } from '@renderer/features/playlists/hooks/usePlaylists'
import { useSettings } from '@renderer/features/settings'
import { artworkUrl, formatClock, formatDuration } from '@renderer/lib/format'
import { openSettings } from '@renderer/lib/settingsNav'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { GalaxySky } from '../ui/GalaxySky'
import { Icon } from '../ui/Icon'
import './PlayerFooter.css'

type TrackMenuState = { x: number; y: number }

type PlayerFooterProps = {
  /** Optional: also open the right-rail lyrics tab when opening the stage. */
  onOpenRightLyrics?: () => void
  /** Open the right rail on About for the now-playing track. */
  onOpenNowPlaying?: () => void
  /** Queue is currently taking over the right sidebar. */
  queueActive?: boolean
  /** Toggle queue takeover on the right sidebar. */
  onToggleQueue?: () => void
}

export function PlayerFooter({
  onOpenRightLyrics,
  onOpenNowPlaying,
  queueActive = false,
  onToggleQueue
}: PlayerFooterProps): React.JSX.Element {
  const { activeNav, setActiveNav, refresh: refreshLibrary } = useLibrary()
  const { settings, setWarnings } = useSettings()
  const {
    currentTrack,
    isPlaying,
    duration,
    shuffle,
    repeat,
    error,
    setQueueOpen,
    visualizerOpen,
    setVisualizerOpen,
    togglePlay,
    next,
    previous,
    seek,
    toggleShuffle,
    cycleRepeat,
    playNext,
    addToQueue,
    focusTrack,
    syncTrackRow
  } = usePlayback()
  const currentTime = usePlaybackClock()
  const [vizWarnOpen, setVizWarnOpen] = useState(false)
  const [vizWarnDontShow, setVizWarnDontShow] = useState(false)
  /** After Continue once this session, skip the nag until restart (permanent opt-out is separate). */
  const vizWarnSessionAckRef = useRef(false)

  const requestVisualizerToggle = (): void => {
    if (visualizerOpen) {
      setVisualizerOpen(false)
      return
    }
    if (settings.warnings.showVisualizerPhotosensitivity && !vizWarnSessionAckRef.current) {
      setVizWarnDontShow(false)
      setVizWarnOpen(true)
      return
    }
    setVisualizerOpen(true)
  }
  const { volume, muted, setVolume, toggleMute } = usePlaybackVolume()
  const {
    playlists,
    askCreatePlaylistWithTracks,
    addTracks,
    toggleLiked,
    isLiked,
    refresh: refreshPlaylists
  } = usePlaylists()
  const [scrubbing, setScrubbing] = useState(false)
  const [scrubTime, setScrubTime] = useState(0)
  const [trackMenu, setTrackMenu] = useState<TrackMenuState | null>(null)
  const [editTrack, setEditTrack] = useState<TrackRow | null>(null)
  const scrubbingRef = useRef(false)
  const scrubTimeRef = useRef(0)
  const volumeWrapRef = useRef<HTMLDivElement>(null)
  const volumeRef = useRef({ volume, muted, setVolume, toggleMute })
  volumeRef.current = { volume, muted, setVolume, toggleMute }

  useEffect(() => {
    scrubbingRef.current = false
    setScrubbing(false)
    setTrackMenu(null)
  }, [currentTrack?.id])

  // Non-passive wheel so we can preventDefault (Chromium ignores passive preventDefault).
  useEffect(() => {
    const el = volumeWrapRef.current
    if (!el) return
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      const { volume: vol, muted: isMuted, setVolume: setVol, toggleMute: muteToggle } =
        volumeRef.current
      const dir = event.deltaY < 0 ? 1 : event.deltaY > 0 ? -1 : 0
      if (!dir) return
      const step = event.shiftKey ? 0.01 : 0.04
      const base = isMuted ? 0 : vol
      const nextVol = Math.min(1, Math.max(0, Math.round((base + dir * step) * 200) / 200))
      if (isMuted && nextVol > 0) muteToggle()
      setVol(nextVol)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const track = currentTrack
  const hasTrack = !!track
  const art = artworkUrl(track?.artworkKey)
  const durationSec =
    duration > 0 ? duration : track?.durationMs != null ? track.durationMs / 1000 : 0
  const progressMax = Math.max(durationSec, 0.001)
  const seekValue = Math.min(scrubbing ? scrubTime : currentTime, progressMax)
  /* Quarter-percent steps keep the custom knob from shimmering on subpixels. */
  const seekPercent = `${Math.round(Math.min(100, Math.max(0, (seekValue / progressMax) * 100)) * 4) / 4}%`
  const clockTime = scrubbing ? scrubTime : currentTime
  const volumePercent = `${Math.min(100, Math.max(0, (muted ? 0 : volume) * 100))}%`
  const liked = track ? isLiked(track.id) : false
  const lyricsStageOpen = activeNav === 'lyrics'
  const volumeIcon =
    muted || volume <= 0.001
      ? 'volume-off'
      : volume < 0.45
        ? 'volume-down'
        : 'volume-up'

  const timeFromPointer = (event: React.PointerEvent<HTMLInputElement>): number => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) return 0
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    return ratio * progressMax
  }

  const beginScrub = (event: React.PointerEvent<HTMLInputElement>): void => {
    if (!hasTrack) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const next = timeFromPointer(event)
    scrubbingRef.current = true
    scrubTimeRef.current = next
    setScrubbing(true)
    setScrubTime(next)
    seek(next)
  }

  const moveScrub = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const next = Number(event.target.value)
    if (!Number.isFinite(next)) return
    scrubTimeRef.current = next
    setScrubTime(next)
    seek(next)
  }

  const endScrub = (event: React.PointerEvent<HTMLInputElement>): void => {
    if (!scrubbingRef.current) return
    const fromInput = Number(event.currentTarget.value)
    const next = Number.isFinite(fromInput) ? fromInput : scrubTimeRef.current
    scrubTimeRef.current = next
    scrubbingRef.current = false
    setScrubbing(false)
    setScrubTime(next)
    seek(next)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const toggleLyricsStage = (): void => {
    if (lyricsStageOpen) {
      setActiveNav('home')
      return
    }
    setActiveNav('lyrics')
    onOpenRightLyrics?.()
  }

  return (
    <>
    <footer className="player-footer gold-frame" aria-label="Playback controls">
      {settings.appearance.galaxyChrome !== false ? (
        <GalaxySky variant="chrome" seed={29} />
      ) : null}
      <div className="player-footer__now">
        {hasTrack && track ? (
          <div className="player-footer__track-row">
            <button
              type="button"
              className="player-footer__now-card"
              data-groove-tip="Open now playing"
              onClick={() => {
                focusTrack(track)
                onOpenNowPlaying?.()
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                setTrackMenu({ x: event.clientX, y: event.clientY })
              }}
            >
              <span className="player-footer__thumb" aria-hidden>
                {art ? <img src={art} alt="" /> : <Icon name="moon" />}
              </span>
              <span className="player-footer__text">
                <span className="player-footer__title">{track.title}</span>
                <span className="player-footer__artist">{track.artistName}</span>
                {error ? <em className="player-footer__error">{error}</em> : null}
              </span>
            </button>
            <button
              type="button"
              className={`player-footer__love ug-candy-heart${liked ? ' is-liked' : ''}`}
              aria-label={liked ? 'Remove from Loved Songs' : 'Add to Loved Songs'}
              data-groove-tip={liked ? 'Remove from Loved' : 'Mark as loved'}
              onClick={() => void toggleLiked(track.id)}
            >
              <Icon name="heart" size={24} />
            </button>
          </div>
        ) : (
          <div className="player-footer__track-row">
            <div className="player-footer__now-card is-empty">
              <span className="player-footer__thumb" aria-hidden>
                <Icon name="moon" />
              </span>
              <span className="player-footer__text">
                <strong>No track playing</strong>
                <span className="player-footer__artist">Pick a song from your library</span>
                {error ? <em className="player-footer__error">{error}</em> : null}
              </span>
            </div>
          </div>
        )}
      </div>

      {trackMenu && track ? (
        <TrackContextMenu
          x={trackMenu.x}
          y={trackMenu.y}
          track={track}
          liked={liked}
          playlists={playlists}
          onClose={() => setTrackMenu(null)}
          onAddToPlaylist={(playlistId) => {
            void addTracks(playlistId, [track.id])
          }}
          onNewPlaylist={() => askCreatePlaylistWithTracks([track.id])}
          onToggleLoved={() => {
            void toggleLiked(track.id)
          }}
          onPlayNext={() => playNext(track)}
          onAddToQueue={() => addToQueue(track)}
          onEditMetadata={() => setEditTrack(track)}
        />
      ) : null}

      {editTrack ? (
        <TrackEditModal
          open
          track={editTrack}
          onClose={() => setEditTrack(null)}
          onSaved={(updated) => {
            syncTrackRow(updated)
            void refreshLibrary()
            void refreshPlaylists()
          }}
        />
      ) : null}

      <div className="player-footer__transport">
        <div className="player-footer__controls">
          <button
            type="button"
            aria-label="Shuffle"
            aria-pressed={shuffle}
            className={shuffle ? 'is-active' : undefined}
            data-groove-tip={
              shuffle ? 'Shuffle is on' : 'Shuffle the order of songs'
            }
            onClick={toggleShuffle}
          >
            <Icon name="shuffle" />
          </button>
          <button
            type="button"
            aria-label="Previous"
            data-groove-tip="Back one track"
            onClick={previous}
            disabled={!hasTrack}
          >
            <Icon name="prev" />
          </button>
          <button
            type="button"
            className="player-footer__play"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            data-groove-tip={isPlaying ? 'Pause the music' : 'Hit play'}
            onClick={togglePlay}
            disabled={!hasTrack}
          >
            <Icon
              name={isPlaying ? 'pause' : 'play'}
              size={28}
              className={isPlaying ? undefined : 'player-footer__play-icon'}
            />
          </button>
          <button
            type="button"
            aria-label="Next"
            data-groove-tip="Skip ahead"
            onClick={next}
            disabled={!hasTrack}
          >
            <Icon name="next" />
          </button>
          <button
            type="button"
            aria-label={`Repeat ${repeat}`}
            aria-pressed={repeat !== 'off'}
            className={repeat !== 'off' ? 'is-active' : undefined}
            data-groove-tip={
              repeat === 'off'
                ? 'Repeat off'
                : repeat === 'all'
                  ? 'Loop the whole queue'
                  : 'Loop this track'
            }
            onClick={cycleRepeat}
          >
            <Icon name={repeat === 'one' ? 'repeat-one' : 'repeat'} />
          </button>
        </div>
        <div className="player-footer__seek">
          <span>{formatClock(clockTime)}</span>
          <div
            className={`player-footer__seek-rail${hasTrack ? '' : ' is-disabled'}`}
            style={{ ['--ug-range' as string]: seekPercent }}
          >
            <input
              type="range"
              min={0}
              max={progressMax}
              step={0.1}
              value={seekValue}
              aria-label="Seek"
              disabled={!hasTrack}
              onPointerDown={beginScrub}
              onPointerUp={endScrub}
              onPointerCancel={endScrub}
              onChange={moveScrub}
            />
            {/* Custom knob — native range thumbs shimmer their borders while scrubbing. */}
            <span className="player-footer__seek-knob" aria-hidden />
          </div>
          <span>{formatDuration(track?.durationMs ?? (durationSec > 0 ? durationSec * 1000 : null))}</span>
        </div>
      </div>

      <div className="player-footer__extras">
        <div className="player-footer__sound">
          <div className="player-footer__volume" ref={volumeWrapRef}>
            <button
              type="button"
              className={`player-footer__icon${muted || volume <= 0.001 ? ' is-muted' : ''}`}
              aria-label={muted || volume <= 0.001 ? 'Unmute' : 'Mute'}
              aria-pressed={muted || volume <= 0.001}
              data-groove-tip={muted || volume <= 0.001 ? 'Bring the sound back' : 'Mute the volume'}
              onClick={toggleMute}
            >
              <Icon name={volumeIcon} size={18} />
            </button>
            <div
              className="player-footer__volume-rail"
              style={{ ['--ug-range' as string]: volumePercent }}
            >
              <input
                type="range"
                className="ug-slider ug-slider--bare"
                min={0}
                max={1}
                step={0.005}
                value={muted ? 0 : volume}
                aria-label="Volume"
                onChange={(event) => {
                  const nextVol = Number(event.target.value)
                  if (muted && nextVol > 0) toggleMute()
                  setVolume(nextVol)
                }}
              />
              {/* Custom knob — keeps gold rim out of the Buttons hue filter. */}
              <span className="player-footer__volume-knob" aria-hidden />
            </div>
          </div>
        </div>
        <div className="player-footer__tools" aria-label="Playback tools">
          <button
            type="button"
            className={`player-footer__icon${lyricsStageOpen ? ' is-active' : ''}`}
            aria-label={lyricsStageOpen ? 'Close lyrics view' : 'Open lyrics in main view'}
            aria-pressed={lyricsStageOpen}
            data-groove-tip={lyricsStageOpen ? 'Hide the lyric stage' : 'Pull up the lyrics'}
            onClick={toggleLyricsStage}
          >
            <Icon name="lyrics" />
          </button>
          <button
            type="button"
            className={`player-footer__icon${visualizerOpen ? ' is-active' : ''}`}
            aria-label={visualizerOpen ? 'Close visualizer' : 'Open music visualizer'}
            aria-pressed={visualizerOpen}
            data-groove-tip={visualizerOpen ? 'Turn off the visualizer' : 'Turn on the visualizer'}
            onClick={requestVisualizerToggle}
          >
            <Icon name="visualizer" />
          </button>
          <button
            type="button"
            className={`player-footer__icon${queueActive ? ' is-active' : ''}`}
            aria-label={queueActive ? 'Close queue' : 'Open queue'}
            aria-pressed={queueActive}
            data-groove-tip={queueActive ? 'Close the queue' : 'Open the queue'}
            onClick={() => {
              const nextOpen = !queueActive
              setQueueOpen(nextOpen)
              onToggleQueue?.()
            }}
          >
            <Icon name="queue" />
          </button>
          <button
            type="button"
            className="player-footer__icon"
            aria-label="Mini player"
            data-groove-tip="Mini player — coming soon"
            disabled
          >
            <Icon name="mini" />
          </button>
        </div>
      </div>
    </footer>

    <ConfirmDialog
      open={vizWarnOpen}
      title="Photosensitivity warning"
      message={
        'Some visualizations use bright flashes, strobing, and rapid color changes.\n\n' +
        'If you have photosensitive epilepsy or are sensitive to flashing lights, skip the visualizer or choose calmer presets.\n\n' +
        'The visualizer does not start until you continue.'
      }
      confirmLabel="Continue"
      cancelLabel="Cancel"
      danger={false}
      onCancel={() => setVizWarnOpen(false)}
      onConfirm={() => {
        vizWarnSessionAckRef.current = true
        if (vizWarnDontShow) {
          setWarnings({ showVisualizerPhotosensitivity: false })
        }
        setVizWarnOpen(false)
        setVisualizerOpen(true)
      }}
      extra={
        <>
          <div className="confirm-dialog__toggle-row">
            <span id="viz-warn-dont-show-label">Do not show this warning again</span>
            <button
              type="button"
              role="switch"
              aria-checked={vizWarnDontShow}
              aria-labelledby="viz-warn-dont-show-label"
              className={`confirm-dialog__switch${vizWarnDontShow ? ' is-on' : ''}`}
              onClick={() => setVizWarnDontShow((value) => !value)}
            >
              <span className="confirm-dialog__switch-thumb" />
            </button>
          </div>
          <button
            type="button"
            className="confirm-dialog__link"
            onClick={() => {
              setVizWarnOpen(false)
              openSettings({ focus: 'warnings' })
            }}
          >
            Open Warning Toggles in Settings
          </button>
        </>
      }
    />
    </>
  )
}
