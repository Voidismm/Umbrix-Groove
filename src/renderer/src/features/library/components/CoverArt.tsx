import { artworkUrl } from '@renderer/lib/format'

type CoverArtProps = {
  title: string
  artworkKey?: string | null
  tone?: string
}

/** Album/track cover with gradient fallback when art is missing. */
export function CoverArt({
  title,
  artworkKey,
  tone = 'violet'
}: CoverArtProps): React.JSX.Element {
  const src = artworkUrl(artworkKey)
  return (
    <div className={`cover cover--${tone}`} aria-hidden>
      {src ? <img src={src} alt="" /> : <span>{title.slice(0, 1)}</span>}
    </div>
  )
}
