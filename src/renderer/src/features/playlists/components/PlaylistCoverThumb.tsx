import type { PlaylistSummary } from '@shared/types'
import { artworkUrl } from '@renderer/lib/format'
import { Icon } from '@renderer/components/ui/Icon'
import './PlaylistCoverThumb.css'

type PlaylistCoverThumbProps = {
  playlist?: PlaylistSummary
  size?: number
  /** Stretch to fill a square card frame (grid tiles). */
  fill?: boolean
}

/** Playlist art — custom cover, else track collage / first art, else icon. */
export function PlaylistCoverThumb({
  playlist,
  size = 28,
  fill = false
}: PlaylistCoverThumbProps): React.JSX.Element {
  const custom = artworkUrl(playlist?.coverKey)
  const keys = playlist?.coverArtKeys ?? []
  const system = !!playlist?.isSystem
  const className = [
    'playlist-cover',
    fill ? 'playlist-cover--fill' : '',
    keys.length >= 4 && !custom ? 'playlist-cover--collage' : '',
    !custom && keys.length === 0 ? 'playlist-cover--fallback' : ''
  ]
    .filter(Boolean)
    .join(' ')
  const style = fill ? undefined : { width: size, height: size }
  const iconSize = fill ? 48 : Math.max(12, size * 0.45)

  if (custom) {
    return (
      <span className={className} style={style} aria-hidden>
        <img src={custom} alt="" />
      </span>
    )
  }

  if (keys.length >= 4) {
    return (
      <span className={className} style={style} aria-hidden>
        {keys.slice(0, 4).map((key) => (
          <img key={key} src={artworkUrl(key) ?? undefined} alt="" />
        ))}
      </span>
    )
  }

  if (keys[0]) {
    return (
      <span className={className} style={style} aria-hidden>
        <img src={artworkUrl(keys[0]) ?? undefined} alt="" />
      </span>
    )
  }

  return (
    <span className={className} style={style} aria-hidden>
      <Icon name={system ? 'heart-filled' : 'create-playlist'} size={iconSize} />
    </span>
  )
}
