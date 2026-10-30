import { useEffect, useState } from 'react'
import logoUrl from '@renderer/assets/logi idea 2.png'
import { CHANGELOG, type ChangelogEntry } from '../settings/changelog'
import {
  getSeenChangelogVersion,
  setSeenChangelogVersion
} from '../settings/changelogSeen'
import { GalaxySky } from './GalaxySky'
import './ModalChrome.css'
import './ChangelogDialog.css'

type ChangelogDialogProps = {
  entry: ChangelogEntry | null
  onDismiss: () => void
  /**
   * Settings preview — same chrome, no fullscreen takeover.
   * Edit ChangelogDialog.css while this is open; it is the real modal.
   */
  embedded?: boolean
}

/** What's-new prompt after an update — Umbrix chrome. */
export function ChangelogDialog({
  entry,
  onDismiss,
  embedded = false
}: ChangelogDialogProps): React.JSX.Element | null {
  const [thanksTaken, setThanksTaken] = useState(false)

  useEffect(() => {
    setThanksTaken(false)
  }, [entry?.version])

  useEffect(() => {
    if (!entry || embedded) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [entry, onDismiss, embedded])

  if (!entry) return null

  return (
    <div
      className={`changelog-dialog${embedded ? ' changelog-dialog--embedded' : ''}`}
      role="presentation"
      onClick={() => {
        if (embedded) return
        onDismiss()
      }}
    >
      <div
        className="changelog-dialog__panel gold-frame"
        role="dialog"
        aria-modal={!embedded}
        aria-labelledby="changelog-dialog-title"
        aria-describedby="changelog-dialog-summary"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="changelog-dialog__head">
          <GalaxySky variant="chrome" seed={19} />
          <div className="changelog-dialog__brand" aria-label="Umbrix Groove">
            <img src={logoUrl} alt="" className="changelog-dialog__crest" draggable={false} />
            <span className="changelog-dialog__name">
              <span className="changelog-dialog__name-umbrix">Umbrix</span>
              <span className="changelog-dialog__name-groove">Groove</span>
            </span>
          </div>
        </header>

        <div className="changelog-dialog__body">
          <div className="changelog-dialog__title-row">
            <h2 id="changelog-dialog-title" className="changelog-dialog__title">
              What&apos;s new
            </h2>
            <p className="changelog-dialog__version">v{entry.version}</p>
          </div>
          <div className="changelog-dialog__card">
            <p id="changelog-dialog-summary" className="changelog-dialog__summary">
              {entry.summary}
            </p>
            {entry.notes && entry.notes.length > 0 ? (
              <ul className="changelog-dialog__notes">
                {entry.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <footer className="changelog-dialog__foot">
          {thanksTaken ? (
            <span className="changelog-dialog__btn-hole" aria-hidden>
              <span className="changelog-dialog__btn-hole-void" />
              <svg
                className="changelog-dialog__btn-hole-cracks"
                viewBox="0 0 220 56"
                preserveAspectRatio="none"
              >
                <path d="M18 8 L34 20 L28 14 L48 26" />
                <path d="M6 28 L22 30 L14 36 L30 40" />
                <path d="M52 4 L58 16 L70 10 L76 22 L88 14" />
                <path d="M110 2 L108 14 L118 18 L112 28" />
                <path d="M160 6 L148 18 L168 16 L154 30 L172 28" />
                <path d="M200 10 L186 22 L204 26 L190 38" />
                <path d="M212 30 L196 34 L208 42 L184 46" />
                <path d="M40 48 L56 42 L62 50 L78 44" />
                <path d="M130 50 L142 40 L150 52 L164 44" />
              </svg>
            </span>
          ) : (
            <button
              type="button"
              className="ug-modal__btn ug-modal__btn--solid"
              onClick={() => setThanksTaken(true)}
            >
              Cool, thanks.
            </button>
          )}
          {thanksTaken ? (
            <button
              type="button"
              className="ug-modal__btn ug-modal__btn--solid"
              onClick={onDismiss}
            >
              WOW you did SO GOOD, GOOD DEV!
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  )
}

/** Dev-only: force the post-update modal so you can review it. Flip off before ship. */
const FORCE_CHANGELOG_PREVIEW = false

/**
 * After an update, show what's-new once on next launch.
 * Fresh installs seed the seen version quietly (no modal).
 */
export function ChangelogDialogHost(): React.JSX.Element | null {
  const [entry, setEntry] = useState<ChangelogEntry | null>(
    FORCE_CHANGELOG_PREVIEW ? (CHANGELOG[0] ?? null) : null
  )

  useEffect(() => {
    if (FORCE_CHANGELOG_PREVIEW) return
    let cancelled = false
    void (async () => {
      try {
        const version =
          (await window.api?.app?.getVersion?.())?.trim() ||
          CHANGELOG[0]?.version ||
          '0.0.0'
        const seen = getSeenChangelogVersion()
        if (seen == null) {
          setSeenChangelogVersion(version)
          return
        }
        if (seen === version) return
        const found = CHANGELOG.find((item) => item.version === version) ?? null
        if (!found) {
          setSeenChangelogVersion(version)
          return
        }
        if (!cancelled) setEntry(found)
      } catch {
        /* ignore — no modal if version lookup fails */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!entry) return null

  return (
    <ChangelogDialog
      entry={entry}
      onDismiss={() => {
        setSeenChangelogVersion(entry.version)
        setEntry(null)
      }}
    />
  )
}
