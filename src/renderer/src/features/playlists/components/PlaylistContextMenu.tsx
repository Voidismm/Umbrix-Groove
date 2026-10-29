import { useEffect, useLayoutEffect, useRef } from 'react'
import './PlaylistContextMenu.css'

export type PlaylistMenuItem =
  | {
      kind: 'item'
      id: string
      label: string
      danger?: boolean
      disabled?: boolean
      onSelect: () => void
    }
  | { kind: 'separator'; id: string }

type PlaylistContextMenuProps = {
  x: number
  y: number
  items: PlaylistMenuItem[]
  onClose: () => void
}

/** Floating right-click menu for playlist tree actions. */
export function PlaylistContextMenu({
  x,
  y,
  items,
  onClose
}: PlaylistContextMenuProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const pad = 8
    const rect = el.getBoundingClientRect()
    let left = x
    let top = y
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad)
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad)
    }
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }, [x, y, items])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    const onPointer = (event: MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="playlist-ctx"
      role="menu"
      style={{ left: x, top: y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) =>
        item.kind === 'separator' ? (
          <div key={item.id} className="playlist-ctx__sep" role="separator" />
        ) : (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={`playlist-ctx__item${item.danger ? ' is-danger' : ''}`}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return
              item.onSelect()
              onClose()
            }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  )
}
