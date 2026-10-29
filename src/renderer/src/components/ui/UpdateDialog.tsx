import { useEffect, useRef, useState } from 'react'
import logoUrl from '@renderer/assets/umbrix-groove-logo.png'
import { Icon } from './Icon'
import './UpdateDialog.css'

export type UpdatePhase = 'available' | 'downloading' | 'ready' | 'error' | null

type UpdateDialogProps = {
  phase: UpdatePhase
  version?: string
  percent?: number
  errorMessage?: string | null
  onAccept: () => void
  onDismiss: () => void
}

/** In-app update prompt — Umbrix chrome instead of a bare OS dialog. */
export function UpdateDialog({
  phase,
  version,
  percent = 0,
  errorMessage,
  onAccept,
  onDismiss
}: UpdateDialogProps): React.JSX.Element | null {
  useEffect(() => {
    if (!phase || phase === 'downloading') return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, onDismiss])

  if (!phase) return null

  const title =
    phase === 'available'
      ? version
        ? `Umbrix Groove ${version}`
        : 'Update available'
      : phase === 'downloading'
        ? 'Downloading update'
        : phase === 'ready'
          ? 'Ready to install'
          : 'Update failed'

  const body =
    phase === 'available'
      ? version
        ? `Update ${version} is ready.`
        : 'An update is ready.'
      : phase === 'downloading'
        ? "Reaching into the Void for this fuckin' update…"
        : phase === 'ready'
          ? 'Download finished. Restart Umbrix Groove to finish installing.'
          : (errorMessage ?? 'Something went wrong while updating.')

  const confirmLabel =
    phase === 'available'
      ? 'Install'
      : phase === 'ready'
        ? 'Restart now'
        : phase === 'error'
          ? 'Close'
          : null

  const cancelLabel = phase === 'downloading' ? null : phase === 'error' ? null : 'Later'
  const busy = phase === 'downloading'

  return (
    <div
      className="update-dialog"
      role="presentation"
      onClick={() => {
        if (!busy && phase !== 'ready') onDismiss()
      }}
    >
      <div
        className="update-dialog__panel gold-frame"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="update-dialog-title"
        aria-describedby="update-dialog-message"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="update-dialog__glow" aria-hidden />
        <header className="update-dialog__head">
          <div className="update-dialog__brand">
            <img src={logoUrl} alt="" className="update-dialog__logo" />
            <div>
              <p className="update-dialog__eyebrow">Umbrix Groove</p>
              <h2 id="update-dialog-title">{title}</h2>
            </div>
          </div>
          {!busy ? (
            <button
              type="button"
              className="update-dialog__close"
              aria-label="Close"
              onClick={onDismiss}
            >
              <Icon name="close" size={16} />
            </button>
          ) : null}
        </header>

        {version && phase !== 'error' && phase !== 'available' ? (
          <p className="update-dialog__version">v{version}</p>
        ) : null}

        <p id="update-dialog-message" className="update-dialog__message">
          {body}
        </p>

        {phase === 'downloading' ? (
          <div className="update-dialog__progress" aria-label={`Download ${Math.round(percent)} percent`}>
            <div className="update-dialog__progress-track">
              <div
                className="update-dialog__progress-fill"
                style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
              />
            </div>
            <span>{Math.round(percent)}%</span>
          </div>
        ) : null}

        <footer className="update-dialog__foot">
          {cancelLabel ? (
            <button
              type="button"
              className="update-dialog__btn update-dialog__btn--ghost"
              disabled={busy}
              onClick={onDismiss}
            >
              {cancelLabel}
            </button>
          ) : null}
          {confirmLabel ? (
            <button
              type="button"
              className="update-dialog__btn update-dialog__btn--solid"
              disabled={busy}
              onClick={() => {
                if (phase === 'error') onDismiss()
                else onAccept()
              }}
            >
              {confirmLabel}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  )
}

/** Subscribes to main-process updater events and drives UpdateDialog. */
export function UpdateDialogHost(): React.JSX.Element | null {
  const [phase, setPhase] = useState<UpdatePhase>(null)
  const [version, setVersion] = useState<string | undefined>()
  const [percent, setPercent] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const versionRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const api = window.api?.app
    if (!api?.onUpdateEvent) return

    return api.onUpdateEvent((event) => {
      if (event.type === 'available') {
        versionRef.current = event.version
        setVersion(event.version)
        setPercent(0)
        setErrorMessage(null)
        setPhase('available')
      } else if (event.type === 'progress') {
        setPhase('downloading')
        setPercent(event.percent)
      } else if (event.type === 'ready') {
        const nextVersion = event.version ?? versionRef.current
        setVersion(nextVersion)
        setPercent(100)
        setPhase('ready')
      } else if (event.type === 'error') {
        setErrorMessage(event.message)
        setPhase('error')
      }
    })
  }, [])

  if (!phase) return null

  return (
    <UpdateDialog
      phase={phase}
      version={version}
      percent={percent}
      errorMessage={errorMessage}
      onAccept={() => {
        if (phase === 'available') {
          setPhase('downloading')
          setPercent(0)
          window.api.app.respondToUpdate(true)
          return
        }
        if (phase === 'ready') {
          window.api.app.respondToUpdate(true)
        }
      }}
      onDismiss={() => {
        if (phase === 'available' || phase === 'ready') {
          window.api.app.respondToUpdate(false)
        }
        setPhase(null)
      }}
    />
  )
}
