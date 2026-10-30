import { useState } from 'react'
import { NAV_ITEMS } from '@renderer/app/navigation'
import { useLibrary } from '@renderer/features/library'
import { usePlayback } from '@renderer/features/player'
import { useSettings } from '@renderer/features/settings'
import {
  PlaylistContextMenu,
  PlaylistTree,
  usePlaylists,
  type PlaylistMenuItem
} from '@renderer/features/playlists'
import { CandyScroll } from '../ui/CandyScroll'
import { GalaxySky } from '../ui/GalaxySky'
import { Icon } from '../ui/Icon'
import './LeftSidebar.css'

type LeftSidebarProps = {
  collapsed?: boolean
}

type NavMenuState = {
  x: number
  y: number
  items: PlaylistMenuItem[]
}

export function LeftSidebar({ collapsed = false }: LeftSidebarProps): React.JSX.Element {
  const {
    activeNav,
    setActiveNav,
    summary,
    scanning,
    selectAlbum,
    selectArtist,
    selectGenre,
    rescanAll
  } = useLibrary()
  const { selectPlaylist } = usePlaylists()
  const { setVisualizerOpen } = usePlayback()
  const { settings } = useSettings()
  const [navMenu, setNavMenu] = useState<NavMenuState | null>(null)

  const songCount = summary.trackCount

  return (
    <aside
      className={`left-sidebar gold-frame${collapsed ? ' is-collapsed' : ''}`}
      aria-label="Library navigation"
    >
      {settings.appearance.galaxyChrome !== false ? (
        <GalaxySky variant="chrome" seed={47} />
      ) : null}
      <nav className="left-sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const isSongs = item.id === 'songs'
          const tip = isSongs ? `${item.label} · ${songCount}` : item.label
          return (
            <button
              key={item.id}
              type="button"
              className={`left-sidebar__nav-item${
                activeNav === item.id ||
                (item.id === 'home' && activeNav === 'daily-mix') ||
                (item.id === 'songs' &&
                  (activeNav === 'albums' || activeNav === 'artists'))
                  ? ' is-active'
                  : ''
              }`}
              data-tip={tip}
              aria-label={isSongs ? `${item.label}, ${songCount} songs` : item.label}
              onClick={() => {
                setVisualizerOpen(false)
                selectAlbum(null)
                selectArtist(null)
                selectGenre(null)
                selectPlaylist(null)
                setActiveNav(item.id)
              }}
              onContextMenu={
                isSongs
                  ? (event) => {
                      event.preventDefault()
                      setNavMenu({
                        x: event.clientX,
                        y: event.clientY,
                        items: [
                          {
                            kind: 'item',
                            id: 'rescan',
                            label: scanning ? 'Scanning…' : 'Rescan library',
                            disabled: scanning,
                            onSelect: () => void rescanAll()
                          }
                        ]
                      })
                    }
                  : undefined
              }
            >
              <Icon name={item.icon} size={18} />
              <span className="left-sidebar__nav-label">{item.label}</span>
              {isSongs ? (
                <span className="left-sidebar__nav-count" aria-hidden>
                  {songCount}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      {navMenu ? (
        <PlaylistContextMenu
          x={navMenu.x}
          y={navMenu.y}
          items={navMenu.items}
          onClose={() => setNavMenu(null)}
        />
      ) : null}

      <div className="left-sidebar__section left-sidebar__section--grow">
        {!collapsed && (
          <div className="left-sidebar__section-head">
            <span className="left-sidebar__section-title">
              <Icon name="create-playlist" size={14} />
              <span>Playlists</span>
            </span>
          </div>
        )}
        <CandyScroll className="left-sidebar__tree" label="Scroll playlists">
          <PlaylistTree compact={collapsed} />
        </CandyScroll>
      </div>
    </aside>
  )
}
