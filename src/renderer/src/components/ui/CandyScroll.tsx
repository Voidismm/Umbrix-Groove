import { useCallback, useEffect, useRef, useState } from 'react'
import './CandyScroll.css'

type CandyScrollProps = {
  children: React.ReactNode
  className?: string
  viewportClassName?: string
  /** Accessible name for the scrollbar thumb. */
  label?: string
  role?: string
}

type ThumbDrag = {
  pointerId: number
  startY: number
  startScroll: number
}

const MIN_THUMB = 40

/**
 * Vertical scroll area with the candy plate scrollbar (same look as home rails).
 * Native scrollbar thumbs cannot paint the PNG in Chromium.
 */
export function CandyScroll({
  children,
  className,
  viewportClassName,
  label = 'Scroll',
  role
}: CandyScrollProps): React.JSX.Element {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<ThumbDrag | null>(null)
  const [overflows, setOverflows] = useState(false)
  const [thumb, setThumb] = useState({ height: 0, top: 0 })

  const sync = useCallback((): void => {
    const el = viewportRef.current
    const track = trackRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    const can = max > 8
    setOverflows(can)
    if (!can || !track) {
      setThumb({ height: 0, top: 0 })
      return
    }
    const trackH = track.clientHeight
    const ratio = el.clientHeight / el.scrollHeight
    const height = Math.max(MIN_THUMB, Math.round(trackH * ratio))
    const travel = Math.max(0, trackH - height)
    const top = max <= 0 ? 0 : (el.scrollTop / max) * travel
    setThumb({ height, top })
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    sync()
    const onScroll = (): void => sync()
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => sync())
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [sync, children])

  useEffect(() => {
    if (!overflows) return
    sync()
    const track = trackRef.current
    if (!track) return
    const ro = new ResizeObserver(() => sync())
    ro.observe(track)
    return () => ro.disconnect()
  }, [overflows, sync])

  const scrollFromThumbTop = (thumbTop: number): void => {
    const el = viewportRef.current
    const track = trackRef.current
    if (!el || !track) return
    const max = el.scrollHeight - el.clientHeight
    const travel = Math.max(0, track.clientHeight - thumb.height)
    if (max <= 0 || travel <= 0) return
    el.scrollTop = (Math.min(travel, Math.max(0, thumbTop)) / travel) * max
  }

  const onThumbPointerDown = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) return
    const el = viewportRef.current
    if (!el) return
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScroll: el.scrollTop
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onThumbPointerMove = (event: React.PointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current
    const el = viewportRef.current
    const track = trackRef.current
    if (!drag || !el || !track || drag.pointerId !== event.pointerId) return
    const max = el.scrollHeight - el.clientHeight
    const travel = Math.max(0, track.clientHeight - thumb.height)
    if (max <= 0 || travel <= 0) return
    const dy = event.clientY - drag.startY
    el.scrollTop = drag.startScroll + (dy / travel) * max
  }

  const onThumbPointerUp = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
    dragRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
  }

  const onTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('.candy-bar__thumb')) return
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const y = event.clientY - rect.top - thumb.height / 2
    scrollFromThumbTop(y)
  }

  return (
    <div
      className={['candy-scroll', overflows ? 'is-overflowing' : '', className].filter(Boolean).join(' ')}
      role={role}
    >
      <div
        ref={viewportRef}
        className={['candy-scroll__viewport', viewportClassName].filter(Boolean).join(' ')}
      >
        {children}
      </div>
      {overflows ? (
        <div className="candy-scroll__rail" aria-hidden={false}>
          <div
            ref={trackRef}
            className="candy-bar candy-bar--y"
            role="presentation"
            onPointerDown={onTrackPointerDown}
          >
            <button
              type="button"
              className="candy-bar__thumb"
              aria-label={label}
              style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
              onPointerDown={onThumbPointerDown}
              onPointerMove={onThumbPointerMove}
              onPointerUp={onThumbPointerUp}
              onPointerCancel={onThumbPointerUp}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
