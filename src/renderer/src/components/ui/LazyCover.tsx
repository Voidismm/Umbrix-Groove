import { useEffect, useState } from 'react'

type LazyCoverProps = {
  src: string | null
  label: string
  /** Display size hint for the browser (row thumbs are 40px). */
  size?: number
  className?: string
}

/**
 * List cover thumb for virtualized rows.
 * Virtualizers already unmount offscreen cells — defer attaching umbrix:// src by
 * two frames so a fast fling can cancel before decode starts.
 */
export function LazyCover({
  src,
  label,
  size = 40,
  className
}: LazyCoverProps): React.JSX.Element {
  const [activeSrc, setActiveSrc] = useState<string | null>(null)

  useEffect(() => {
    setActiveSrc(null)
    if (!src) return
    let cancelled = false
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        if (!cancelled) setActiveSrc(src)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [src])

  return (
    <div className={className} aria-hidden>
      {activeSrc ? (
        <img
          src={activeSrc}
          alt=""
          width={size}
          height={size}
          decoding="async"
          fetchPriority="low"
        />
      ) : (
        <span>{label.slice(0, 1)}</span>
      )}
    </div>
  )
}
