import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { normalizeHexColor } from '@renderer/lib/playlistAccent'
import './GrooveColorPicker.css'

type Hsv = { h: number; s: number; v: number }

type GrooveColorPickerProps = {
  value: string
  onChange: (hex: string) => void
  disabled?: boolean
  label?: string
  'aria-label'?: string
}

/** Brand-leaning presets that sit well on Umbrix chrome. */
const PRESETS = [
  '#6b3aad',
  '#9a6ad4',
  '#4a2080',
  '#c9a45c',
  '#e8c878',
  '#8b3a5c',
  '#3a6aad',
  '#2f8f6b',
  '#c45c3a',
  '#5c3aad',
  '#1e6f8f',
  '#a35c8f',
  '#7a4a2a',
  '#3d5c4a',
  '#b84a6a',
  '#2a1848'
] as const

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex)
  if (!normalized) return null
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number): string =>
    clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let rp = 0
  let gp = 0
  let bp = 0
  if (h < 60) [rp, gp, bp] = [c, x, 0]
  else if (h < 120) [rp, gp, bp] = [x, c, 0]
  else if (h < 180) [rp, gp, bp] = [0, c, x]
  else if (h < 240) [rp, gp, bp] = [0, x, c]
  else if (h < 300) [rp, gp, bp] = [x, 0, c]
  else [rp, gp, bp] = [c, 0, x]
  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255
  }
}

function hexToHsv(hex: string): Hsv {
  const rgb = hexToRgb(hex) ?? { r: 107, g: 58, b: 173 }
  return rgbToHsv(rgb.r, rgb.g, rgb.b)
}

function hsvToHex(hsv: Hsv): string {
  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v)
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}

type PanelBox = { top: number; left: number }

/** Custom Umbrix color picker — no OS/browser color dialog chrome. */
export function GrooveColorPicker({
  value,
  onChange,
  disabled = false,
  label = 'Custom color',
  'aria-label': ariaLabel
}: GrooveColorPickerProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [panelBox, setPanelBox] = useState<PanelBox | null>(null)
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value))
  const [hexDraft, setHexDraft] = useState(normalizeHexColor(value) ?? value)

  const liveHex = useMemo(() => hsvToHex(hsv), [hsv])
  const hueColor = useMemo(() => hsvToHex({ h: hsv.h, s: 1, v: 1 }), [hsv.h])

  useEffect(() => {
    const next = normalizeHexColor(value)
    if (!next) return
    if (next.toLowerCase() === liveHex.toLowerCase()) return
    setHsv(hexToHsv(next))
    setHexDraft(next)
  }, [value, liveHex])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPanelBox(null)
      return
    }
    const place = (): void => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(280, window.innerWidth - 24)
      const height = 320
      const left = clamp(rect.left, 12, window.innerWidth - width - 12)
      const below = rect.bottom + 8
      const top =
        below + height > window.innerHeight - 12
          ? Math.max(12, rect.top - height - 8)
          : below
      setPanelBox({ top, left })
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
      if (panelRef.current?.contains(target)) return
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

  const commitHsv = (next: Hsv): void => {
    setHsv(next)
    const hex = hsvToHex(next)
    setHexDraft(hex)
    onChange(hex)
  }

  const readSv = (clientX: number, clientY: number): void => {
    const el = svRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const s = clamp((clientX - rect.left) / rect.width, 0, 1)
    const v = clamp(1 - (clientY - rect.top) / rect.height, 0, 1)
    commitHsv({ ...hsv, s, v })
  }

  const readHue = (clientX: number): void => {
    const el = hueRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const h = clamp(((clientX - rect.left) / rect.width) * 360, 0, 359.999)
    commitHsv({ ...hsv, h })
  }

  const bindDrag = (
    move: (event: PointerEvent) => void
  ): ((event: React.PointerEvent) => void) => {
    return (event) => {
      event.preventDefault()
      const target = event.currentTarget
      target.setPointerCapture(event.pointerId)
      move(event.nativeEvent)
      const onMove = (ev: PointerEvent): void => move(ev)
      const onUp = (): void => {
        target.releasePointerCapture(event.pointerId)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
  }

  const panel =
    open && panelBox
      ? createPortal(
          <div
            ref={panelRef}
            className="groove-color__panel"
            style={{ top: panelBox.top, left: panelBox.left }}
            role="dialog"
            aria-label="Choose color"
          >
            <div className="groove-color__presets" role="listbox" aria-label="Preset colors">
              {PRESETS.map((hex) => {
                const selected = liveHex.toLowerCase() === hex.toLowerCase()
                return (
                  <button
                    key={hex}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`groove-color__preset${selected ? ' is-selected' : ''}`}
                    style={{ background: hex }}
                    aria-label={hex}
                    onClick={() => {
                      const next = hexToHsv(hex)
                      commitHsv(next)
                    }}
                  />
                )
              })}
            </div>

            <div
              ref={svRef}
              className="groove-color__sv"
              style={{ background: hueColor }}
              onPointerDown={bindDrag((ev) => readSv(ev.clientX, ev.clientY))}
            >
              <div className="groove-color__sv-white" />
              <div className="groove-color__sv-black" />
              <div
                className="groove-color__sv-thumb"
                style={{
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                  background: liveHex
                }}
              />
            </div>

            <div
              ref={hueRef}
              className="groove-color__hue"
              onPointerDown={bindDrag((ev) => readHue(ev.clientX))}
            >
              <div
                className="groove-color__hue-thumb"
                style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }}
              />
            </div>

            <label className="groove-color__hex-row">
              <span>Hex</span>
              <input
                className="groove-color__hex"
                value={hexDraft}
                spellCheck={false}
                onChange={(event) => {
                  const raw = event.target.value
                  setHexDraft(raw)
                  const normalized = normalizeHexColor(raw)
                  if (normalized) {
                    setHsv(hexToHsv(normalized))
                    onChange(normalized)
                  }
                }}
                onBlur={() => {
                  const normalized = normalizeHexColor(hexDraft) ?? liveHex
                  setHexDraft(normalized)
                }}
              />
            </label>
          </div>,
          document.body
        )
      : null

  return (
    <div ref={rootRef} className="groove-color">
      <button
        ref={triggerRef}
        type="button"
        className={`groove-color__trigger${open ? ' is-open' : ''}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ?? label}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev)
        }}
      >
        <span className="groove-color__chip" style={{ background: liveHex }} aria-hidden />
        <span className="groove-color__label">{label}</span>
      </button>
      {panel}
    </div>
  )
}
