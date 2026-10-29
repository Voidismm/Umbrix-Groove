import { useEffect } from 'react'
import { Icon } from './Icon'
import './ConfirmDialog.css'

export type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Centered in-app confirm — matches Umbrix modal chrome. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  busy = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div className="confirm-dialog" role="presentation" onClick={() => !busy && onCancel()}>
      <div
        className="confirm-dialog__panel gold-frame"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="confirm-dialog__head">
          <h2 id="confirm-dialog-title">{title}</h2>
          <button
            type="button"
            className="confirm-dialog__close"
            aria-label="Close"
            disabled={busy}
            onClick={onCancel}
          >
            <Icon name="close" size={16} />
          </button>
        </header>
        <p id="confirm-dialog-message" className="confirm-dialog__message">
          {message}
        </p>
        <footer className="confirm-dialog__foot">
          <button
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--ghost"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-dialog__btn confirm-dialog__btn--solid${
              danger ? ' is-danger' : ''
            }`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}
