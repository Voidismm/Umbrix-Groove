import './GalaxySky.css'

type FieldStar = {
  x: number
  y: number
  r: number
  o: number
  twinkle: boolean
  twinkleDur: string
  twinkleDelay: string
  gold: boolean
}

type GalaxySkyProps = {
  /** Dense field for the home hero; lighter for chrome strips. */
  variant?: 'hero' | 'chrome'
  /** Offset the RNG so panes do not share the same constellation. */
  seed?: number
  className?: string
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let n = Math.imul(t ^ (t >>> 15), 1 | t)
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}

function makeLayer(
  count: number,
  seed: number,
  opts: {
    rMin: number
    rMax: number
    oMin: number
    oMax: number
    goldChance: number
    twinkleChance: number
  }
): FieldStar[] {
  const rand = mulberry32(seed)
  const stars: FieldStar[] = []
  for (let i = 0; i < count; i += 1) {
    const twinkle = rand() < opts.twinkleChance
    stars.push({
      x: rand() * 1200,
      y: rand() * 800,
      r: opts.rMin + rand() * (opts.rMax - opts.rMin),
      o: opts.oMin + rand() * (opts.oMax - opts.oMin),
      twinkle,
      twinkleDur: twinkle ? `${(3.4 + rand() * 3.2).toFixed(2)}s` : '0s',
      twinkleDelay: twinkle ? `${(rand() * 14).toFixed(2)}s` : '0s',
      gold: rand() < opts.goldChance
    })
  }
  return stars
}

function buildField(variant: 'hero' | 'chrome', seed: number): FieldStar[] {
  if (variant === 'hero') {
    return [
      ...makeLayer(220, seed + 41, {
        rMin: 0.14,
        rMax: 0.4,
        oMin: 0.28,
        oMax: 0.78,
        goldChance: 0.06,
        twinkleChance: 0.06
      }),
      ...makeLayer(70, seed + 77, {
        rMin: 0.35,
        rMax: 0.75,
        oMin: 0.45,
        oMax: 0.9,
        goldChance: 0.12,
        twinkleChance: 0.28
      }),
      ...makeLayer(28, seed + 103, {
        rMin: 0.6,
        rMax: 1.55,
        oMin: 0.62,
        oMax: 1,
        goldChance: 0.18,
        twinkleChance: 0.55
      })
    ]
  }

  return [
    ...makeLayer(90, seed + 19, {
      rMin: 0.16,
      rMax: 0.42,
      oMin: 0.22,
      oMax: 0.7,
      goldChance: 0.08,
      twinkleChance: 0.1
    }),
    ...makeLayer(28, seed + 53, {
      rMin: 0.35,
      rMax: 0.8,
      oMin: 0.4,
      oMax: 0.88,
      goldChance: 0.14,
      twinkleChance: 0.32
    }),
    ...makeLayer(12, seed + 91, {
      rMin: 0.55,
      rMax: 1.35,
      oMin: 0.55,
      oMax: 1,
      goldChance: 0.2,
      twinkleChance: 0.5
    })
  ]
}

const fieldCache = new Map<string, FieldStar[]>()

function getField(variant: 'hero' | 'chrome', seed: number): FieldStar[] {
  const key = `${variant}:${seed}`
  let field = fieldCache.get(key)
  if (!field) {
    field = buildField(variant, seed)
    fieldCache.set(key, field)
  }
  return field
}

/** Shared Umbrix-style galaxy wash + twinkling starfield. */
export function GalaxySky({
  variant = 'chrome',
  seed = 0,
  className
}: GalaxySkyProps): React.JSX.Element {
  const field = getField(variant, seed)

  return (
    <div
      className={['galaxy-sky', `galaxy-sky--${variant}`, className].filter(Boolean).join(' ')}
      aria-hidden
    >
      <div className="galaxy-sky__nebula" />
      <svg
        className="galaxy-sky__chart"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
      >
        {field.map((star, index) => (
          <circle
            key={index}
            className={star.gold ? 'galaxy-sky__star galaxy-sky__star--gold' : 'galaxy-sky__star'}
            data-twinkle={star.twinkle ? 'true' : undefined}
            cx={star.x}
            cy={star.y}
            r={star.r}
            style={
              {
                ['--star-o' as string]: String(star.o),
                ...(star.twinkle
                  ? {
                      ['--twinkle-dur' as string]: star.twinkleDur,
                      ['--twinkle-delay' as string]: star.twinkleDelay
                    }
                  : null)
              } as React.CSSProperties
            }
          />
        ))}
      </svg>
    </div>
  )
}

/** @deprecated use GalaxySky variant="hero" */
export function HeroNightSky(): React.JSX.Element {
  return <GalaxySky variant="hero" seed={0} className="hero__sky" />
}
