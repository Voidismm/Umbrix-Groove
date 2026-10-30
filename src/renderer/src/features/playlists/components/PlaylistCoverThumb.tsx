import type { CSSProperties } from 'react'
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

function isLovedSongs(playlist?: PlaylistSummary): boolean {
  return playlist?.systemKey === 'liked' || playlist?.name === 'Liked Songs'
}

/** Playlist art — custom cover, else track collage / first art, else icon. */
export function PlaylistCoverThumb({
  playlist,
  size = 28,
  fill = false
}: PlaylistCoverThumbProps): React.JSX.Element {
  const custom = artworkUrl(playlist?.coverKey)
  const keys = playlist?.coverArtKeys ?? []
  const loved = isLovedSongs(playlist)
  const className = [
    'playlist-cover',
    fill ? 'playlist-cover--fill' : '',
    loved ? 'playlist-cover--loved' : '',
    !loved && keys.length >= 4 && !custom ? 'playlist-cover--collage' : '',
    !loved && !custom && keys.length === 0 ? 'playlist-cover--fallback' : ''
  ]
    .filter(Boolean)
    .join(' ')
  const style = fill ? undefined : { width: size, height: size }
  const iconSize = fill ? 48 : Math.max(12, size * 0.45)
  /* Sidebar thumbs stay larger with gold rim; grid fill is smaller and plain. */
  const heartSize = fill ? 48 : Math.max(18, Math.round(size * 0.72))
  const heartClass = fill
    ? 'ug-candy-heart ug-candy-heart--art ug-candy-heart--art-plain'
    : 'ug-candy-heart ug-candy-heart--art'

  if (loved) {
    return (
      <span className={className} style={style} aria-hidden>
        <span
          className={heartClass}
          style={{ '--ug-candy-heart-size': `${heartSize}px` } as CSSProperties}
        />
      </span>
    )
  }

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
      <Icon name="create-playlist" size={iconSize} />
    </span>
  )
}
