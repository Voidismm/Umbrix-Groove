import { useEffect } from 'react'
import { ModalHeader } from './ModalHeader'
import './ModalChrome.css'
import './ConfirmDialog.css'

export type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  /** Optional content between the message and footer (toggle, link, etc.). */
  extra?: React.ReactNode
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
  extra,
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
        <ModalHeader
          title={title}
          titleId="confirm-dialog-title"
          seed={17}
          onClose={onCancel}
          closeDisabled={busy}
        />
        <div className="confirm-dialog__body">
          <p id="confirm-dialog-message" className="confirm-dialog__message">
            {message}
          </p>
          {extra ? <div className="confirm-dialog__extra">{extra}</div> : null}
        </div>
        <footer className="confirm-dialog__foot">
          <button
            type="button"
            className="ug-modal__btn ug-modal__btn--ghost"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`ug-modal__btn ug-modal__btn--solid${danger ? ' is-danger' : ''}`}
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
