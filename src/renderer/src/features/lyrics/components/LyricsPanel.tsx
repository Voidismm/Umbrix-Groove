import { useEffect, useMemo, useRef, useState } from 'react'
import type { LyricsPayload } from '@shared/types'
import { usePlayback } from '@renderer/features/player'
import { useSettings } from '@renderer/features/settings'
import './LyricsPanel.css'

type LyricsPanelProps = {
  /** sidebar = compact right rail; stage = full main content */
  variant?: 'sidebar' | 'stage'
}

function activeLineIndex(lines: LyricsPayload['lines'], timeMs: number): number {
  let active = -1
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].timeMs
    if (t == null) continue
    if (t <= timeMs) active = i
    else break
  }
  return active
}

/**
 * Idle until the user clicks play. Leaving the Lyrics tab / closing the sidebar
 * unmounts this panel, which drops sync work and shows the play prompt again.
 */
export function LyricsPanel({ variant = 'sidebar' }: LyricsPanelProps): React.JSX.Element {
  const [enabled, setEnabled] = useState(false)

  if (!enabled) {
    return (
      <div className={`lyrics-panel lyrics-panel--${variant} lyrics-panel--idle`}>
        <button
          type="button"
          className="lyrics-panel__play-btn"
          onClick={() => setEnabled(true)}
        >
          Click to play lyrics
        </button>
      </div>
    )
  }

  return <LyricsPanelActive variant={variant} />
}

/** Fetches and syncs lyrics — only mounted while the user has opted in. */
function LyricsPanelActive({ variant }: { variant: 'sidebar' | 'stage' }): React.JSX.Element {
  const { currentTrack, focusedTrack, currentTime } = usePlayback()
  const track = focusedTrack ?? currentTrack
  const { settings } = useSettings()
  const [lyrics, setLyrics] = useState<LyricsPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLParagraphElement | null>(null)
  const preferSidecar = settings.lyrics.preferSidecar
  const autoScroll = settings.lyrics.autoScroll
  const reduceMotion = settings.appearance.reduceMotion

  useEffect(() => {
    let cancelled = false
    if (!track || !window.api?.lyrics) {
      setLyrics(null)
      return
    }
    setLoading(true)
    setError(null)
    void window.api.lyrics
      .getForTrack(track.id, { preferSidecar })
      .then((payload) => {
        if (!cancelled) setLyrics(payload)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [track?.id, preferSidecar])

  const timeMs = Math.floor(currentTime * 1000)
  const syncToPlayback = !!track && track.id === currentTrack?.id
  const activeIndex = useMemo(() => {
    if (!lyrics?.synced || !syncToPlayback) return -1
    return activeLineIndex(lyrics.lines, timeMs)
  }, [lyrics, timeMs, syncToPlayback])

  useEffect(() => {
    if (!autoScroll) return
    if (activeIndex < 0 || !activeRef.current || !listRef.current) return
    activeRef.current.scrollIntoView({
      block: 'center',
      behavior: reduceMotion ? 'auto' : 'smooth'
    })
  }, [activeIndex, autoScroll, reduceMotion])

  if (!track) {
    return <p className="lyrics-panel__empty">Click a track to look for lyrics.</p>
  }
  if (loading) {
    return <p className="lyrics-panel__empty">Looking for lyrics…</p>
  }
  if (error) {
    return <p className="lyrics-panel__empty">{error}</p>
  }
  if (!lyrics || lyrics.source === 'none' || lyrics.lines.length === 0) {
    const fileHint = track.path?.split(/[/\\]/).pop() ?? 'YourSong.mp3'
    const baseName = fileHint.replace(/\.[^.]+$/, '')
    return (
      <div className="lyrics-panel__empty lyrics-panel__empty--help">
        <p>No local lyrics found for this track.</p>
        <p className="lyrics-panel__hint">
          Grab synced lyrics from{' '}
          <a
            href="https://spotiflac.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Spotiflac
          </a>
          — it is a solid source for tracks with lyrics, art, and tags.
        </p>
        <ol className="lyrics-panel__steps">
          <li>
            Download or copy the <code>.lrc</code> (synced) or plain <code>.txt</code> /{' '}
            <code>.lyrics</code> file.
          </li>
          <li>
            Put it in the same folder as the audio, named like the track — e.g.{' '}
            <code>{baseName}.lrc</code> next to <code>{fileHint}</code>.
          </li>
          <li>Come back here. Umbrix Groove picks it up locally (no upload).</li>
        </ol>
        <p className="lyrics-panel__hint">
          You can also embed lyrics in the file tags if you prefer that over a sidecar.
        </p>
      </div>
    )
  }

  return (
    <div className={`lyrics-panel lyrics-panel--${variant}`}>
      <div className="lyrics-panel__scroll" ref={listRef}>
        {lyrics.lines.map((line, index) => {
          const active = lyrics.synced && index === activeIndex
          return (
            <p
              key={`${line.timeMs ?? 'x'}-${index}`}
              ref={active ? activeRef : undefined}
              className={`lyrics-panel__line${active ? ' is-active' : ''}${line.text ? '' : ' is-gap'}`}
            >
              {line.text || '♮'}
            </p>
          )
        })}
      </div>
    </div>
  )
}
