import { artworkUrl, formatDuration } from '@renderer/lib/format'
import { Icon } from '@renderer/components/ui/Icon'
import { usePlayback } from '../PlaybackContext'
import './QueuePanel.css'

export function QueuePanel(): React.JSX.Element | null {
  const {
    queueOpen,
    setQueueOpen,
    queue,
    queueIndex,
    currentTrack,
    jumpToQueueIndex,
    removeFromQueue,
    clearQueue
  } = usePlayback()

  if (!queueOpen) return null

  const upcoming = queue.slice(queueIndex + 1)

  return (
    <div className="queue-panel gold-frame" role="dialog" aria-label="Play queue">
      <header className="queue-panel__head">
        <div>
          <h2>Queue</h2>
          <p>
            {queue.length} track{queue.length === 1 ? '' : 's'}
            {currentTrack ? ` · now ${currentTrack.title}` : ''}
          </p>
        </div>
        <div className="queue-panel__actions">
          <button
            type="button"
            onClick={() => {
              if (queue.length > 0 && window.confirm('Clear the entire queue?')) {
                clearQueue()
              }
            }}
            disabled={queue.length === 0}
          >
            Clear
          </button>
          <button type="button" aria-label="Close queue" onClick={() => setQueueOpen(false)}>
            <Icon name="close" className="queue-panel__close-icon" />
          </button>
        </div>
      </header>

      {currentTrack && (
        <section className="queue-panel__section">
          <h3>Now playing</h3>
          <button
            type="button"
            className="queue-panel__row is-active"
            onClick={() => jumpToQueueIndex(queueIndex)}
          >
            <RowArt artworkKey={currentTrack.artworkKey} title={currentTrack.title} />
            <div className="queue-panel__meta">
              <strong>{currentTrack.title}</strong>
              <span>{currentTrack.artistName}</span>
            </div>
            <span className="queue-panel__dur">{formatDuration(currentTrack.durationMs)}</span>
          </button>
        </section>
      )}

      <section className="queue-panel__section queue-panel__section--grow">
        <h3>Next up</h3>
        {upcoming.length === 0 ? (
          <p className="queue-panel__empty">Nothing waiting. Play a song or add tracks to the queue.</p>
        ) : (
          <ul className="queue-panel__list">
            {upcoming.map((track, offset) => {
              const index = queueIndex + 1 + offset
              return (
                <li key={`${track.id}-${index}`}>
                  <button
                    type="button"
                    className="queue-panel__row"
                    onClick={() => jumpToQueueIndex(index)}
                  >
                    <RowArt artworkKey={track.artworkKey} title={track.title} />
                    <div className="queue-panel__meta">
                      <strong>{track.title}</strong>
                      <span>{track.artistName}</span>
                    </div>
                    <span className="queue-panel__dur">{formatDuration(track.durationMs)}</span>
                  </button>
                  <button
                    type="button"
                    className="queue-panel__remove"
                    aria-label={`Remove ${track.title}`}
                    onClick={() => removeFromQueue(index)}
                  >
                    <Icon name="close" className="queue-panel__close-icon" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function RowArt({
  artworkKey,
  title
}: {
  artworkKey: string | null
  title: string
}): React.JSX.Element {
  const src = artworkUrl(artworkKey)
  return (
    <div className="queue-panel__art" aria-hidden>
      {src ? <img src={src} alt="" /> : <span>{title.slice(0, 1)}</span>}
    </div>
  )
}
