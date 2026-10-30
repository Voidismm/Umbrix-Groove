import { useEffect, useState } from 'react'
import logo from '@renderer/assets/logi idea 2.png'
import { useLibrary } from '@renderer/features/library'
import { useSettings } from '@renderer/features/settings'
import { GalaxySky } from '../ui/GalaxySky'
import { Icon } from '../ui/Icon'
import './TitleBar.css'

type TitleBarProps = {
  leftCollapsed: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
  rightOpen: boolean
  onOpenSettings: () => void
}

export function TitleBar({
  leftCollapsed,
  onToggleLeft,
  onToggleRight,
  rightOpen,
  onOpenSettings
}: TitleBarProps): React.JSX.Element {
  const { searchQuery, setSearchQuery, setActiveNav } = useLibrary()
  const { settings } = useSettings()
  const [draft, setDraft] = useState(searchQuery)

  useEffect(() => {
    setDraft(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchQuery(draft)
    }, 220)
    return () => window.clearTimeout(handle)
  }, [draft, setSearchQuery])

  return (
    <header className="titlebar">
      {settings.appearance.galaxyChrome !== false ? (
        <GalaxySky variant="chrome" seed={11} />
      ) : null}
      <div className="titlebar__brand" aria-label="Umbrix Groove">
        <img
          className="titlebar__crest"
          src={logo}
          alt=""
          width={36}
          height={36}
          draggable={false}
        />
        <div className="titlebar__brand-text">
          <span className="titlebar__name">
            <span className="titlebar__name-umbrix">Umbrix</span>
            <span className="titlebar__name-groove">Groove</span>
          </span>
        </div>
        <span className="titlebar__brand-rule" aria-hidden />
        <button
          type="button"
          className="titlebar__icon-btn"
          aria-label={leftCollapsed ? 'Expand library sidebar' : 'Collapse library sidebar'}
          aria-pressed={!leftCollapsed}
          onClick={onToggleLeft}
        >
          <Icon name={leftCollapsed ? 'panel-left' : 'panel-right'} size={22} />
        </button>
      </div>

      <div className="titlebar__search">
        <Icon name="search" className="titlebar__search-icon" />
        <input
          type="search"
          placeholder="Search songs, albums, artists, genres..."
          aria-label="Search library"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            if (event.target.value.trim()) {
              setActiveNav('songs')
            }
          }}
        />
        {draft ? (
          <button
            type="button"
            className="titlebar__search-clear"
            aria-label="Clear search"
            onClick={() => {
              setDraft('')
              setSearchQuery('')
            }}
          >
            <Icon name="close" size={14} />
          </button>
        ) : null}
      </div>

      <div className="titlebar__actions">
        <button
          type="button"
          className="titlebar__icon-btn titlebar__icon-btn--settings"
          aria-label="Open settings"
          onClick={onOpenSettings}
        >
          <Icon name="settings-heart" size={22} />
        </button>
        <span className="titlebar__actions-rule" aria-hidden />
        <button
          type="button"
          className="titlebar__icon-btn"
          aria-label={rightOpen ? 'Hide now playing panel' : 'Show now playing panel'}
          aria-pressed={rightOpen}
          onClick={onToggleRight}
        >
          <Icon name={rightOpen ? 'panel-left' : 'panel-right'} size={22} />
        </button>
        <div className="titlebar__window">
          <button
            type="button"
            className="titlebar__win-btn titlebar__win-btn--minimize"
            aria-label="Minimize"
            onClick={() => window.api?.window.minimize()}
          >
            <Icon name="minimize" size={20} />
          </button>
          <button
            type="button"
            className="titlebar__win-btn"
            aria-label="Maximize"
            onClick={() => window.api?.window.maximize()}
          >
            <Icon name="maximize" size={16} />
          </button>
          <button
            type="button"
            className="titlebar__win-btn titlebar__win-btn--close"
            aria-label="Close"
            onClick={() => window.api?.window.close()}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
