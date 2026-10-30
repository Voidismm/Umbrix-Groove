import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './GrooveSelect.css'

export type GrooveSelectOption = {
  value: string
  label: string
}

type GrooveSelectProps = {
  value: string
  options: GrooveSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  /** Accessible name when no visible label is wired via htmlFor. */
  'aria-label'?: string
}

type MenuBox = { top: number; left: number; width: number; maxHeight: number }

/** Custom Umbrix dropdown — no native browser select chrome. */
export function GrooveSelect({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'None',
  'aria-label': ariaLabel
}: GrooveSelectProps): React.JSX.Element {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [menuBox, setMenuBox] = useState<MenuBox | null>(null)

  const selected = options.find((option) => option.value === value) ?? null
  const display = selected?.label ?? placeholder

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuBox(null)
      return
    }
    const place = (): void => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const gap = 6
      const spaceBelow = window.innerHeight - rect.bottom - gap - 12
      const spaceAbove = rect.top - gap - 12
      const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove
      const maxHeight = Math.min(240, preferBelow ? spaceBelow : spaceAbove)
      const height = Math.max(120, maxHeight)
      const top = preferBelow
        ? rect.bottom + gap
        : Math.max(12, rect.top - gap - height)
      setMenuBox({
        top,
        left: rect.left,
        width: rect.width,
        maxHeight: height
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent): void => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const index = Math.max(
      0,
      options.findIndex((option) => option.value === value)
    )
    setActiveIndex(index)
  }, [open, options, value])

  const pick = (next: string): void => {
    onChange(next)
    setOpen(false)
  }

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) => Math.min(options.length - 1, Math.max(0, prev) + 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) => Math.max(0, (prev < 0 ? 0 : prev) - 1))
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const option = options[activeIndex]
      if (option) pick(option.value)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(options.length - 1)
    }
  }

  const menu =
    open && menuBox
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            className="groove-select__menu"
            role="listbox"
            tabIndex={-1}
            style={{
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
              maxHeight: menuBox.maxHeight
            }}
            aria-activedescendant={
              activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
            }
            onKeyDown={onMenuKeyDown}
          >
            {options.map((option, index) => {
              const selectedOption = option.value === value
              const active = index === activeIndex
              return (
                <button
                  key={`${option.value || 'none'}-${index}`}
                  id={`${listId}-opt-${index}`}
                  type="button"
                  role="option"
                  aria-selected={selectedOption}
                  className={`groove-select__option${selectedOption ? ' is-selected' : ''}${
                    active ? ' is-active' : ''
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => pick(option.value)}
                >
                  {option.label}
                </button>
              )
            })}
          </div>,
          document.body
        )
      : null

  return (
    <div ref={rootRef} className="groove-select">
      <button
        ref={triggerRef}
        type="button"
        className={`groove-select__trigger${open ? ' is-open' : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev)
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={`groove-select__value${selected ? '' : ' is-placeholder'}`}>
          {display}
        </span>
        <span className="groove-select__chevron" aria-hidden />
      </button>
      {menu}
    </div>
  )
}
