import { useEffect, useRef, useState } from 'react'
import './GrooveTip.css'

type TipState = {
  text: string
  x: number
  y: number
  side: 'above' | 'below' | 'left'
}

function tipTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null
  const el = node.closest(
    'button, a, [role="button"], [data-groove-tip], input[type="range"], summary'
  )
  return el instanceof HTMLElement ? el : null
}

function tipText(el: HTMLElement): string | null {
  // Explicit opt-out (keep aria-label for screen readers, skip hover chrome).
  if (el.hasAttribute('data-no-groove-tip')) return null
  const custom = el.getAttribute('data-groove-tip')?.trim()
  if (custom) return custom
  const labelled = el.getAttribute('aria-label')?.trim()
  if (labelled) return labelled
  const titled = el.getAttribute('title')?.trim()
  if (titled) return titled
  return null
}

function tipSide(el: HTMLElement): TipState['side'] {
  const raw = el.getAttribute('data-groove-tip-side')
  if (raw === 'below' || raw === 'left' || raw === 'above') return raw
  // Header chrome: keep tips under the cursor so they do not cover the buttons.
  if (el.closest('.titlebar')) return 'below'
  return 'above'
}

/** Global groove hover labels for buttons and controls. */
export function GrooveTipHost(): React.JSX.Element | null {
  const [tip, setTip] = useState<TipState | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const clear = (): void => {
      activeRef.current = null
      setTip(null)
    }

    const place = (el: HTMLElement): void => {
      // Default ON; only hide when Appearance → Button tips is explicitly off.
      if (document.documentElement.dataset.buttonTips === 'false') {
        clear()
        return
      }
      const text = tipText(el)
      if (!text) {
        clear()
        return
      }
      const isDisabled =
        el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
      // Still tip opted-in controls (e.g. coming-soon) even when disabled.
      if (isDisabled && !el.hasAttribute('data-groove-tip')) {
        clear()
        return
      }
      // Wide text rows skip unless they opted in with data-groove-tip.
      if (!el.hasAttribute('data-groove-tip')) {
        const labelText = (el.innerText || '').trim()
        const wide = el.clientWidth > 120 || labelText.length > 28
        const tall = el.clientHeight > 56
        if ((wide || tall) && el.tagName !== 'INPUT') {
          clear()
          return
        }
      }

      const rect = el.getBoundingClientRect()
      const side = tipSide(el)
      let x = rect.left + rect.width / 2
      let y = rect.top
      if (side === 'below') {
        y = rect.bottom
      } else if (side === 'left') {
        x = rect.left
        y = rect.top + rect.height / 2
      }
      activeRef.current = el
      setTip({ text, x, y, side })
    }

    const onOver = (event: MouseEvent): void => {
      const el = tipTarget(event.target)
      if (!el) {
        clear()
        return
      }
      if (activeRef.current === el) return
      place(el)
    }

    const onOut = (event: MouseEvent): void => {
      const el = tipTarget(event.target)
      if (!el || activeRef.current !== el) return
      const next = event.relatedTarget
      if (next instanceof Node && el.contains(next)) return
      clear()
    }

    const onScroll = (): void => clear()
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') clear()
    }

    window.addEventListener('mouseover', onOver, true)
    window.addEventListener('mouseout', onOut, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mouseover', onOver, true)
      window.removeEventListener('mouseout', onOut, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [])

  useEffect(() => {
    const node = tipRef.current
    if (!node || !tip) return
    const pad = 8
    const belowPad = 18
    const rect = node.getBoundingClientRect()
    let left = tip.x
    let top = tip.y
    if (tip.side === 'above') {
      left = tip.x - rect.width / 2
      top = tip.y - rect.height - pad
    } else if (tip.side === 'below') {
      left = tip.x - rect.width / 2
      top = tip.y + belowPad
    } else {
      left = tip.x - rect.width - pad
      top = tip.y - rect.height / 2
    }
    left = Math.min(window.innerWidth - rect.width - 6, Math.max(6, left))
    top = Math.min(window.innerHeight - rect.height - 6, Math.max(6, top))
    node.style.left = `${left}px`
    node.style.top = `${top}px`
  }, [tip])

  if (!tip) return null

  return (
    <div ref={tipRef} className="groove-tip-host" role="tooltip">
      {tip.text}
    </div>
  )
}
