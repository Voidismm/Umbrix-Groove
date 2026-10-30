import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import './CandyScroll.css'
import './RailScroller.css'

type RailScrollerProps = {
  children: React.ReactNode
  /** Extra class on the scroll row (e.g. `rail__row--mixes`). */
  rowClassName?: string
  label?: string
}

type DragState = {
  pointerId: number
  startX: number
  startScroll: number
  moved: boolean
  lastX: number
  lastT: number
  velocity: number
}

type ThumbDragState = {
  pointerId: number
  startX: number
  startScroll: number
}

const FRICTION = 0.95
const MIN_VELOCITY = 0.04
const MAX_VELOCITY = 3.2
const MIN_THUMB = 48

/**
 * Home-page horizontal rail: arrows, custom candy scrollbar (real PNG — Chromium
 * ignores background-image on native scrollbar thumbs), click-drag + flick.
 */
export function RailScroller({
  children,
  rowClassName,
  label
}: RailScrollerProps): React.JSX.Element {
  const rowRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const thumbDragRef = useRef<ThumbDragState | null>(null)
  const suppressClickRef = useRef(false)
  const inertiaRafRef = useRef(0)
  const [overflows, setOverflows] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)
  const [thumb, setThumb] = useState({ width: 0, left: 0 })

  const stopInertia = useCallback((): void => {
    if (!inertiaRafRef.current) return
    window.cancelAnimationFrame(inertiaRafRef.current)
    inertiaRafRef.current = 0
  }, [])

  const sync = useCallback((): void => {
    const el = rowRef.current
    const track = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const can = max > 8
    setOverflows(can)
    setAtStart(!can || el.scrollLeft <= 2)
    setAtEnd(!can || el.scrollLeft >= max - 2)

    if (!can || !track) {
      setThumb({ width: 0, left: 0 })
      return
    }
    const trackW = track.clientWidth
    const ratio = el.clientWidth / el.scrollWidth
    const width = Math.max(MIN_THUMB, Math.round(trackW * ratio))
    const travel = Math.max(0, trackW - width)
    const left = max <= 0 ? 0 : (el.scrollLeft / max) * travel
    setThumb({ width, left })
  }, [])

  const startInertia = useCallback(
    (initialVelocity: number): void => {
      const el = rowRef.current
      if (!el) return
      stopInertia()
      let velocity = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, initialVelocity))
      if (Math.abs(velocity) < MIN_VELOCITY) return

      let last = performance.now()
      const tick = (now: number): void => {
        const node = rowRef.current
        if (!node) {
          inertiaRafRef.current = 0
          return
        }
        const dt = Math.min(32, now - last)
        last = now
        node.scrollLeft += velocity * dt
        velocity *= FRICTION

        const max = node.scrollWidth - node.clientWidth
        if (node.scrollLeft <= 0) {
          node.scrollLeft = 0
          velocity = 0
        } else if (node.scrollLeft >= max) {
          node.scrollLeft = max
          velocity = 0
        }

        if (Math.abs(velocity) >= MIN_VELOCITY) {
          inertiaRafRef.current = window.requestAnimationFrame(tick)
          return
        }
        inertiaRafRef.current = 0
        sync()
      }
      inertiaRafRef.current = window.requestAnimationFrame(tick)
    },
    [stopInertia, sync]
  )

  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    sync()
    const onScroll = (): void => sync()
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => sync())
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
      stopInertia()
    }
  }, [sync, stopInertia, children])

  useEffect(() => {
    if (!overflows) return
    sync()
    const track = trackRef.current
    if (!track) return
    const ro = new ResizeObserver(() => sync())
    ro.observe(track)
    return () => ro.disconnect()
  }, [overflows, sync])

  const scrollByPage = (dir: -1 | 1): void => {
    const el = rowRef.current
    if (!el) return
    stopInertia()
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.8), behavior: 'smooth' })
  }

  const onPointerDownCapture = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    const el = rowRef.current
    if (!el || !overflows) return
    if ((event.target as HTMLElement | null)?.closest?.('.rail-scroller__arrow')) return
    if ((event.target as HTMLElement | null)?.closest?.('.candy-bar')) return
    stopInertia()
    const now = performance.now()
    // Do NOT capture yet — early capture steals click from mix/song cards.
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScroll: el.scrollLeft,
      moved: false,
      lastX: event.clientX,
      lastT: now,
      velocity: 0
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    const el = rowRef.current
    if (!drag || !el || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.startX
    // Keep threshold high enough that normal clicks still land on cards.
    if (!drag.moved && Math.abs(dx) < 10) return
    if (!drag.moved) {
      drag.moved = true
      el.classList.add('is-dragging')
      try {
        el.setPointerCapture(event.pointerId)
      } catch {
        /* capture unsupported */
      }
    }
    event.preventDefault()
    el.scrollLeft = drag.startScroll - dx

    const now = performance.now()
    const dt = now - drag.lastT
    if (dt > 0) {
      const instant = (drag.lastX - event.clientX) / dt
      drag.velocity = drag.velocity * 0.7 + instant * 0.3
    }
    drag.lastX = event.clientX
    drag.lastT = now
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    const el = rowRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const didDrag = drag.moved
    if (didDrag) {
      suppressClickRef.current = true
      const stale = performance.now() - drag.lastT > 80
      startInertia(stale ? 0 : drag.velocity)
    }
    dragRef.current = null
    el?.classList.remove('is-dragging')
    if (didDrag) {
      try {
        el?.releasePointerCapture(event.pointerId)
      } catch {
        /* already released */
      }
    }
  }

  const scrollFromThumbLeft = (thumbLeft: number): void => {
    const el = rowRef.current
    const track = trackRef.current
    if (!el || !track) return
    const max = el.scrollWidth - el.clientWidth
    const travel = Math.max(0, track.clientWidth - thumb.width)
    if (max <= 0 || travel <= 0) return
    el.scrollLeft = (Math.min(travel, Math.max(0, thumbLeft)) / travel) * max
  }

  const onThumbPointerDown = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) return
    const el = rowRef.current
    if (!el) return
    event.preventDefault()
    event.stopPropagation()
    stopInertia()
    thumbDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScroll: el.scrollLeft
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onThumbPointerMove = (event: React.PointerEvent<HTMLButtonElement>): void => {
    const drag = thumbDragRef.current
    const el = rowRef.current
    const track = trackRef.current
    if (!drag || !el || !track || drag.pointerId !== event.pointerId) return
    const max = el.scrollWidth - el.clientWidth
    const travel = Math.max(0, track.clientWidth - thumb.width)
    if (max <= 0 || travel <= 0) return
    const dx = event.clientX - drag.startX
    el.scrollLeft = drag.startScroll + (dx / travel) * max
  }

  const onThumbPointerUp = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (!thumbDragRef.current || thumbDragRef.current.pointerId !== event.pointerId) return
    thumbDragRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
  }

  const onTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('.rail-scroller__thumb')) return
    const track = trackRef.current
    if (!track) return
    stopInertia()
    const rect = track.getBoundingClientRect()
    const x = event.clientX - rect.left - thumb.width / 2
    scrollFromThumbLeft(x)
  }

  const onDragStartCapture = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
  }

  const onClickCapture = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (!suppressClickRef.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClickRef.current = false
  }

  return (
    <div className={`rail-scroller${overflows ? ' is-overflowing' : ''}`}>
      <div className="rail-scroller__frame">
        {overflows ? (
          <button
            type="button"
            className="rail-scroller__arrow rail-scroller__arrow--prev"
            aria-label={`Scroll ${label ?? 'row'} left`}
            disabled={atStart}
            onClick={() => scrollByPage(-1)}
          >
            <Icon name="prev" size={22} />
          </button>
        ) : null}

        <div
          ref={rowRef}
          className={['rail__row', 'rail-scroller__row', rowClassName].filter(Boolean).join(' ')}
          onPointerDownCapture={onPointerDownCapture}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDragStartCapture={onDragStartCapture}
          onClickCapture={onClickCapture}
        >
          {children}
        </div>

        {overflows ? (
          <button
            type="button"
            className="rail-scroller__arrow rail-scroller__arrow--next"
            aria-label={`Scroll ${label ?? 'row'} right`}
            disabled={atEnd}
            onClick={() => scrollByPage(1)}
          >
            <Icon name="next" size={22} />
          </button>
        ) : null}
      </div>

      {overflows ? (
        <div
          ref={trackRef}
          className="candy-bar candy-bar--x rail-scroller__bar"
          role="presentation"
          onPointerDown={onTrackPointerDown}
        >
          <button
            type="button"
            className="candy-bar__thumb"
            aria-label={`Scroll ${label ?? 'row'}`}
            style={{ width: thumb.width, transform: `translateX(${thumb.left}px)` }}
            onPointerDown={onThumbPointerDown}
            onPointerMove={onThumbPointerMove}
            onPointerUp={onThumbPointerUp}
            onPointerCancel={onThumbPointerUp}
          />
        </div>
      ) : null}
    </div>
  )
}
