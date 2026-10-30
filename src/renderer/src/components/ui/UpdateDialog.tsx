import { useEffect, useRef, useState } from 'react'
import logoUrl from '@renderer/assets/logi idea 2.png'
import { GalaxySky } from './GalaxySky'
import './UpdateDialog.css'

export type UpdatePhase = 'available' | 'downloading' | 'ready' | 'error' | null

type UpdateDialogProps = {
  phase: UpdatePhase
  version?: string
  percent?: number
  onAccept: () => void
  onDismiss: () => void
  /**
   * Settings preview — same chrome, no fullscreen takeover.
   * Edit UpdateDialog.css while this is open; it is the real modal.
   */
  embedded?: boolean
}

/** In-app update prompt — Umbrix chrome instead of a bare OS dialog. */
export function UpdateDialog({
  phase,
  version,
  percent = 0,
  onAccept,
  onDismiss,
  embedded = false
}: UpdateDialogProps): React.JSX.Element | null {
  /** 0 = offer, 1 = pout, 2 = button confiscated (black hole). */
  const [declineStep, setDeclineStep] = useState(0)

  useEffect(() => {
    setDeclineStep(0)
  }, [phase])

  useEffect(() => {
    if (!phase || phase === 'downloading' || embedded) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, onDismiss, embedded])

  if (!phase) return null

  const title =
    phase === 'available'
      ? 'Update available'
      : phase === 'downloading'
        ? 'Downloading update'
        : phase === 'ready'
          ? 'Ready to install'
          : 'Update failed'

  const availableBody =
    declineStep === 1
      ? 'But... the update I worked so hard on... :('
      : declineStep >= 2
        ? "Well then I'm taking away your button. Now you can only install it, hmph."
        : "A new update for Umbrix Groove is available!\n\nYou can update it now, or later, I don't care, I'm not your fuckin' mother. But if I was, I'd tell you to update your Umbrix Groove or you won't get any cool new things and bug fixes. Nor will you get any dessert after dinner."

  const body =
    phase === 'available'
      ? availableBody
      : phase === 'downloading'
        ? percent >= 100
          ? 'FINALLY...'
          : percent >= 90
            ? 'Come on already.'
            : percent >= 50
              ? "Fuckin' hells this is a big update, huh?"
              : "Reaching into the Void for this fuckin' update…"
        : phase === 'ready'
          ? 'The download is finally finished. Restart Umbrix Groove.'
          : "Update failed, and I have no fuckin' idea why. Could be anything honestly.\n\nPlease try again later or something."

  const confirmLabel =
    phase === 'available'
      ? "Alright, I'll install it, damn."
      : phase === 'ready'
        ? 'Fuck yeah.'
        : phase === 'error'
          ? 'Fucking shit-ass fuck-ass titties.'
          : null

  const cancelLabel =
    phase !== 'available'
      ? null
      : declineStep === 0
        ? 'No thanks, fam. Maybe later.'
        : declineStep === 1
          ? 'I said no, you little weirdo.'
          : null
  const showDeclineHole = phase === 'available' && declineStep >= 2
  const busy = phase === 'downloading'

  return (
    <div
      className={`update-dialog${embedded ? ' update-dialog--embedded' : ''}`}
      role="presentation"
      onClick={() => {
        if (embedded) return
        if (!busy && phase !== 'ready') onDismiss()
      }}
    >
      <div
        className="update-dialog__panel gold-frame"
        role="alertdialog"
        aria-modal={!embedded}
        aria-labelledby="update-dialog-title"
        aria-describedby="update-dialog-message"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="update-dialog__head">
          <GalaxySky variant="chrome" seed={11} />
          <div className="update-dialog__brand" aria-label="Umbrix Groove">
            <img src={logoUrl} alt="" className="update-dialog__crest" draggable={false} />
            <span className="update-dialog__name">
              <span className="update-dialog__name-umbrix">Umbrix</span>
              <span className="update-dialog__name-groove">Groove</span>
            </span>
          </div>
        </header>

        <div className="update-dialog__body">
          <div className="update-dialog__title-row">
            <h2 id="update-dialog-title" className="update-dialog__title">
              {title}
            </h2>
            {version && phase !== 'error' ? (
              <p className="update-dialog__version">v{version}</p>
            ) : null}
          </div>
          <p
            id="update-dialog-message"
            className={
              phase === 'error'
                ? 'update-dialog__message update-dialog__message--error'
                : 'update-dialog__message'
            }
          >
            {body}
          </p>
        </div>

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
              onClick={() => setDeclineStep((step) => Math.min(2, step + 1))}
            >
              {cancelLabel}
            </button>
          ) : null}
          {showDeclineHole ? (
            <span className="update-dialog__btn-hole" aria-hidden>
              <span className="update-dialog__btn-hole-void" />
              <svg className="update-dialog__btn-hole-cracks" viewBox="0 0 220 56" preserveAspectRatio="none">
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
  const versionRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const api = window.api?.app
    if (!api?.onUpdateEvent) return

    return api.onUpdateEvent((event) => {
      if (event.type === 'available') {
        versionRef.current = event.version
        setVersion(event.version)
        setPercent(0)
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
