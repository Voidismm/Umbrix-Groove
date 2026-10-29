import { useLibrary } from '../hooks/useLibrary'
import './ScanBanner.css'

export function ScanBanner(): React.JSX.Element | null {
  const { scanProgress, scanning, error } = useLibrary()

  if (!scanning && !error && (!scanProgress || scanProgress.phase === 'done')) {
    return null
  }

  if (error && !scanning) {
    return (
      <div className="scan-banner scan-banner--error" role="alert">
        <strong>Library error</strong>
        <span>{error}</span>
      </div>
    )
  }

  if (!scanProgress) {
    return (
      <div className="scan-banner" role="status">
        <strong>Scanning</strong>
        <span>Reading your music folder…</span>
      </div>
    )
  }

  const percent =
    scanProgress.total > 0
      ? Math.min(100, Math.round((scanProgress.processed / scanProgress.total) * 100))
      : scanProgress.phase === 'done'
        ? 100
        : 8

  return (
    <div
      className={`scan-banner${scanProgress.phase === 'error' ? ' scan-banner--error' : ''}`}
      role="status"
    >
      <div className="scan-banner__text">
        <strong>{scanProgress.phase === 'error' ? 'Scan failed' : 'Scanning library'}</strong>
        <span>
          {scanProgress.message ||
            `${scanProgress.processed} / ${scanProgress.total} files · ${scanProgress.added} added · ${scanProgress.updated} updated`}
        </span>
      </div>
      <div className="scan-banner__bar" aria-hidden>
        <div className="scan-banner__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
