import { GalaxySky } from './GalaxySky'
import { Icon } from './Icon'
import './ModalChrome.css'

type ModalHeaderProps = {
  title: string
  titleId?: string
  onClose?: () => void
  showClose?: boolean
  closeDisabled?: boolean
  /** Optional line under the title (e.g. playlist name). */
  subtitle?: string
  /** Galaxy field seed so stacked modals do not share the same sky. */
  seed?: number
}

/** Shared modal header — update-dialog sky wash + the modal’s own title. */
export function ModalHeader({
  title,
  titleId,
  onClose,
  showClose = true,
  closeDisabled = false,
  subtitle,
  seed = 11
}: ModalHeaderProps): React.JSX.Element {
  return (
    <header className="ug-modal__head">
      <GalaxySky variant="chrome" seed={seed} />
      <div className="ug-modal__head-text">
        <h2 id={titleId} className="ug-modal__head-title">
          {title}
        </h2>
        {subtitle ? <p className="ug-modal__head-sub">{subtitle}</p> : null}
      </div>
      {showClose && onClose ? (
        <button
          type="button"
          className="ug-modal__close"
          aria-label="Close"
          disabled={closeDisabled}
          onClick={onClose}
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </header>
  )
}
