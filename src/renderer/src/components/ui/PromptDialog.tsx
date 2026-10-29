import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './Icon'
import './ConfirmDialog.css'

export type PromptDialogProps = {
  open: boolean
  title: string
  message?: string
  label?: string
  initialValue?: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: (value: string) => void
  onCancel: () => void
}

/** In-app text prompt — Electron does not support window.prompt(). */
export function PromptDialog({
  open,
  title,
  message,
  label = 'Name',
  initialValue = '',
  confirmLabel = 'Create',
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onCancel
}: PromptDialogProps): React.JSX.Element | null {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (!open) return
    setValue(initialValue)
    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [open, initialValue])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  const submit = (): void => {
    if (busy) return
    const next = value.trim()
    if (!next) return
    onConfirm(next)
  }

  return (
    <div className="confirm-dialog" role="presentation" onClick={() => !busy && onCancel()}>
      <div
        className="confirm-dialog__panel gold-frame"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="confirm-dialog__head">
          <h2 id="prompt-dialog-title">{title}</h2>
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
        {message ? (
          <p id="prompt-dialog-message" className="confirm-dialog__message">
            {message}
          </p>
        ) : null}
        <form
          className="confirm-dialog__form"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <label className="confirm-dialog__field" htmlFor={inputId}>
            <span>{label}</span>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              value={value}
              disabled={busy}
              autoComplete="off"
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
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
              type="submit"
              className="confirm-dialog__btn confirm-dialog__btn--solid"
              disabled={busy || !value.trim()}
            >
              {busy ? 'Working…' : confirmLabel}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
