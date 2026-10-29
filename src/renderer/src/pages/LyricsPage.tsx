import { LyricsPanel } from '@renderer/features/lyrics'
import { useLibrary } from '@renderer/features/library'
import { usePlayback } from '@renderer/features/player'
import { useSettings } from '@renderer/features/settings'
import { artworkUrl } from '@renderer/lib/format'
import { Icon } from '@renderer/components/ui/Icon'

/** Full-stage lyrics view in the main content area. */
export function LyricsPage(): React.JSX.Element {
  const { currentTrack } = usePlayback()
  const { setActiveNav } = useLibrary()
  const { settings } = useSettings()
  const art = artworkUrl(currentTrack?.artworkKey)

  return (
    <section className="lyrics-stage gold-frame" aria-label="Lyrics">
      <header className="lyrics-stage__head">
        <button
          type="button"
          className="lyrics-stage__back"
          onClick={() => setActiveNav('home')}
        >
          ← Back
        </button>
        <div className="lyrics-stage__now">
          <div className="lyrics-stage__art" aria-hidden>
            {art ? <img src={art} alt="" /> : <Icon name="lyrics" />}
          </div>
          <div>
            <p className="hero__eyebrow">Now playing</p>
            <h2>{currentTrack?.title ?? 'Nothing playing'}</h2>
            <p>{currentTrack?.artistName ?? 'Play a track to open lyrics here'}</p>
          </div>
        </div>
      </header>

      <div className="lyrics-stage__body">
        {settings.lyrics.showInStage ? (
          <LyricsPanel variant="stage" />
        ) : (
          <div className="lyrics-panel__empty">
            <p>Stage lyrics are turned off in Settings.</p>
            <p className="lyrics-panel__hint">Open the right sidebar Lyrics tab, or enable Show in stage view.</p>
          </div>
        )}
      </div>
    </section>
  )
}