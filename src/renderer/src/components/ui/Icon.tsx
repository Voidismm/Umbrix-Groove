type IconProps = {
  name: string
  className?: string
  size?: number
}

/** Map app icon names → files in `src/renderer/src/assets/icons`. */
const ALIASES: Record<string, string> = {
  play: 'play',
  pause: 'pause',
  prev: 'prev',
  next: 'next',
  shuffle: 'shuffle',
  repeat: 'repeat',
  'repeat-one': 'repeat-one',
  heart: 'heart',
  'heart-filled': 'heart-filled',
  star: 'star',
  'star-filled': 'star-filled',
  home: 'home',
  folder: 'folder',
  'create-folder': 'create-folder',
  playlist: 'create-playlist',
  'create-playlist': 'create-playlist',
  'add-to-playlist': 'add-to-playlist',
  delete: 'delete',
  edit: 'edit',
  'bookmark-heart': 'bookmark-heart',
  pin: 'pin',
  check: 'check',
  'check-empty': 'check-empty',
  duration: 'duration',
  queue: 'queue',
  lyrics: 'lyrics',
  mic: 'lyrics',
  visualizer: 'palette',
  viz: 'palette',
  mini: 'mini',
  fullscreen: 'fullscreen',
  'panel-left': 'panel-left',
  'panel-right': 'panel-right',
  close: 'close',
  maximize: 'maximize',
  minimize: 'minimize',
  settings: 'settings-heart',
  'settings-heart': 'settings-heart',
  palette: 'palette',
  browse: 'queue',
  download: 'download',
  volume: 'volume_up',
  'volume-up': 'volume_up',
  'volume-down': 'volume_down',
  'volume-mute': 'volume_mute',
  'volume-off': 'volume_off'
}

const RAW_ICONS = import.meta.glob('../../assets/icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

const PREPARED = new Map<string, string>()

for (const [path, svg] of Object.entries(RAW_ICONS)) {
  const file = path.split(/[/\\]/).pop()?.replace(/\.svg$/i, '')
  if (!file) continue
  PREPARED.set(
    file,
    svg
      .replace(/fill="#e3e3e3"/gi, 'fill="currentColor"')
      .replace(/\s(width|height)="[^"]*"/g, '')
      .replace('<svg', '<svg focusable="false"')
  )
}

function assetSvg(name: string): string | null {
  const file = ALIASES[name] ?? name
  return PREPARED.get(file) ?? null
}

/** App icons — prefers your `icons/` pack (copied into assets), with inline fallbacks. */
export function Icon({ name, className, size = 18 }: IconProps): React.JSX.Element {
  const fromPack = assetSvg(name)
  if (fromPack) {
    return (
      <span
        className={`ug-icon${className ? ` ${className}` : ''}`}
        style={{ width: size, height: size }}
        aria-hidden
        dangerouslySetInnerHTML={{ __html: fromPack }}
      />
    )
  }

  const common = {
    className,
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const
  }

  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
        </svg>
      )
    case 'album':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'artist':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19.5c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
        </svg>
      )
    case 'genre':
      return (
        <svg {...common}>
          <path d="M9 18V6l11-2v12" />
          <circle cx="7" cy="18" r="2.5" />
          <circle cx="18" cy="16" r="2.5" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case 'volume':
      return (
        <svg {...common}>
          <path d="M4 10v4h3l5 4V6L7 10H4zM16.5 8.5a5 5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common}>
          <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 7H4c.5-1.5 2-3 2-7zM10 19a2 2 0 0 0 4 0" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </svg>
      )
    case 'chevron':
      return (
        <svg {...common}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      )
    case 'more':
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'moon':
      return (
        <svg {...common}>
          <path d="M16 3a8 8 0 1 0 5 13 7 7 0 0 1-5-13z" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
  }
}
