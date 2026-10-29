import { useEffect, useRef, useState } from 'react'
import { useLibrary } from '@renderer/features/library'
import { usePlayback } from '@renderer/features/player'
import { TrackContextMenu } from '@renderer/features/playlists'
import { usePlaylists } from '@renderer/features/playlists/hooks/usePlaylists'
import { artworkUrl, formatClock, formatDuration } from '@renderer/lib/format'
import { Icon } from '../ui/Icon'
import './PlayerFooter.css'

type TrackMenuState = { x: number; y: number }

type PlayerFooterProps = {
  /** Optional: also open the right-rail lyrics tab when opening the stage. */
  onOpenRightLyrics?: () => void
  /** Open the right rail on About for the now-playing track. */
  onOpenNowPlaying?: () => void
}

export function PlayerFooter({
  onOpenRightLyrics,
  onOpenNowPlaying
}: PlayerFooterProps): React.JSX.Element {
  const { activeNav, setActiveNav } = useLibrary()
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    shuffle,
    repeat,
    error,
    queueOpen,
    setQueueOpen,
    visualizerOpen,
    setVisualizerOpen,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    playNext,
    addToQueue,
    focusTrack
  } = usePlayback()
  const { playlists, askCreatePlaylistWithTracks, addTracks, toggleLiked, isLiked } = usePlaylists()
  const [scrubbing, setScrubbing] = useState(false)
  const [scrubTime, setScrubTime] = useState(0)
  const [trackMenu, setTrackMenu] = useState<TrackMenuState | null>(null)
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
    <footer className="player-footer gold-frame" aria-label="Playback controls">
      <div className="player-footer__now">
        <div className="player-footer__thumb" aria-hidden>
          {art ? <img src={art} alt="" /> : <Icon name="moon" />}
        </div>
        <div className="player-footer__meta">
          <div className="player-footer__text">
            {hasTrack && track ? (
              <button
                type="button"
                className="player-footer__title"
                title={`${track.title} — show in sidebar`}
                onClick={() => {
                  focusTrack(track)
                  onOpenNowPlaying?.()
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  setTrackMenu({ x: event.clientX, y: event.clientY })
                }}
              >
                {track.title}
              </button>
            ) : (
              <strong>No track playing</strong>
            )}
            <span>{track?.artistName ?? 'Pick a song from your library'}</span>
            {error ? <em className="player-footer__error">{error}</em> : null}
          </div>
          {hasTrack && track ? (
            <button
              type="button"
              className={`player-footer__love${liked ? ' is-liked' : ''}`}
              aria-label={liked ? 'Remove from Loved Songs' : 'Add to Loved Songs'}
              title={liked ? 'Unlove' : 'Love'}
              onClick={() => void toggleLiked(track.id)}
            >
              <Icon name={liked ? 'heart-filled' : 'heart'} size={20} />
            </button>
          ) : null}
        </div>
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
        />
      ) : null}

      <div className="player-footer__transport">
        <div className="player-footer__controls">
          <button
            type="button"
            aria-label="Shuffle"
            aria-pressed={shuffle}
            className={shuffle ? 'is-active' : undefined}
            onClick={toggleShuffle}
          >
            <Icon name="shuffle" />
          </button>
          <button type="button" aria-label="Previous" onClick={previous} disabled={!hasTrack}>
            <Icon name="prev" />
          </button>
          <button
            type="button"
            className="player-footer__play"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={togglePlay}
            disabled={!hasTrack}
          >
            <Icon
              name={isPlaying ? 'pause' : 'play'}
              size={28}
              className={isPlaying ? undefined : 'player-footer__play-icon'}
            />
          </button>
          <button type="button" aria-label="Next" onClick={next} disabled={!hasTrack}>
            <Icon name="next" />
          </button>
          <button
            type="button"
            aria-label={`Repeat ${repeat}`}
            aria-pressed={repeat !== 'off'}
            className={repeat !== 'off' ? 'is-active' : undefined}
            onClick={cycleRepeat}
            title={repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat all' : 'Repeat one'}
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
              className={`player-footer__icon${muted || volume <= 0.001 ? ' is-active' : ''}`}
              aria-label={muted || volume <= 0.001 ? 'Unmute' : 'Mute'}
              aria-pressed={muted || volume <= 0.001}
              onClick={toggleMute}
            >
              <Icon name={volumeIcon} size={18} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.005}
              value={muted ? 0 : volume}
              aria-label="Volume"
              style={{ ['--ug-range' as string]: volumePercent }}
              onChange={(event) => {
                const nextVol = Number(event.target.value)
                if (muted && nextVol > 0) toggleMute()
                setVolume(nextVol)
              }}
            />
          </div>
        </div>
        <div className="player-footer__tools" aria-label="Playback tools">
          <button
            type="button"
            className={`player-footer__icon${lyricsStageOpen ? ' is-active' : ''}`}
            aria-label={lyricsStageOpen ? 'Close lyrics view' : 'Open lyrics in main view'}
            aria-pressed={lyricsStageOpen}
            onClick={toggleLyricsStage}
          >
            <Icon name="lyrics" />
          </button>
          <button
            type="button"
            className={`player-footer__icon${visualizerOpen ? ' is-active' : ''}`}
            aria-label={visualizerOpen ? 'Close visualizer' : 'Open music visualizer'}
            aria-pressed={visualizerOpen}
            title="Visualizer"
            onClick={() => setVisualizerOpen(!visualizerOpen)}
          >
            <Icon name="visualizer" />
          </button>
          <button
            type="button"
            className={`player-footer__icon${queueOpen ? ' is-active' : ''}`}
            aria-label="Queue"
            aria-pressed={queueOpen}
            onClick={() => setQueueOpen(!queueOpen)}
          >
            <Icon name="queue" />
          </button>
          <button type="button" className="player-footer__icon" aria-label="Mini player" disabled>
            <Icon name="mini" />
          </button>
        </div>
      </div>
    </footer>
  )
}
