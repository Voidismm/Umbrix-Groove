import { useEffect, useMemo, useRef, useState } from 'react'
import { AUDIO_EXTENSIONS } from '@shared/constants'
import type { LibraryFolder } from '@shared/types'
import { useLibrary } from '@renderer/features/library'
import {
  useSettings,
  type SeekStepSeconds,
  type VolumeStep
} from '@renderer/features/settings'
import type { SettingsFocusTarget } from '@renderer/lib/settingsNav'
import { ChangelogDialog } from '../ui/ChangelogDialog'
import { GalaxySky } from '../ui/GalaxySky'
import { Icon } from '../ui/Icon'
import { ModalHeader } from '../ui/ModalHeader'
import { CHANGELOG } from './changelog'
import '../ui/ModalChrome.css'
import './SettingsModal.css'

const AUDIO_FORMAT_LABEL = AUDIO_EXTENSIONS.map((ext) => `.${ext}`).join(', ')

type SettingsModalProps = {
  open: boolean
  onClose: () => void
  focusTarget?: SettingsFocusTarget | null
  onFocusHandled?: () => void
  /** Close settings and open the floating live appearance studio. */
  onEditAppearance?: () => void
}

type SettingsSectionId =
  | 'folders'
  | 'guide-have'
  | 'guide-folder'
  | 'appearance'
  | 'warnings'
  | 'hotkeys'
  | 'playback'
  | 'library'
  | 'lyrics'
  | 'about'
  | 'changelog'
  | 'updates'

type SettingsNavItem = {
  id: SettingsSectionId
  label: string
  description: string
  icon: string
  keywords: string
}

const GUIDE_SECTION_IDS: SettingsSectionId[] = ['guide-have', 'guide-folder']

const GUIDE_PARENT = {
  label: 'How to Add Music',
  keywords: 'guide help howto music folder formats lyrics artwork tags add'
} as const

const GUIDE_CHILDREN: SettingsNavItem[] = [
  {
    id: 'guide-have',
    label: 'How to add music you already have',
    description: 'Point Umbrix Groove at a folder that already holds your audio files.',
    icon: 'folder',
    keywords:
      'guide help howto already have library folder formats lyrics artwork tags add folder music folders settings watch rescan'
  },
  {
    id: 'guide-folder',
    label: 'Where to get music free (Piracy)',
    description: 'Downloadable music you can keep and play offline.',
    icon: 'folder',
    keywords:
      'guide help buy legal purchase download bandcamp amazon itunes qobuz store free mornye registry'
  }
]

function haystackForNavItem(
  item: Pick<SettingsNavItem, 'label' | 'description' | 'keywords'>
): string {
  return `${item.label} ${item.description} ${item.keywords}`.toLowerCase()
}

/** Every query token must appear somewhere in the section haystack. */
function navItemMatches(
  item: Pick<SettingsNavItem, 'label' | 'description' | 'keywords'>,
  q: string
): boolean {
  const tokens = q
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
  if (tokens.length === 0) return true
  const haystack = haystackForNavItem(item)
  return tokens.every((token) => haystack.includes(token))
}

function scoreNavMatch(
  item: Pick<SettingsNavItem, 'label' | 'description' | 'keywords'>,
  q: string
): number {
  const needle = q.toLowerCase().trim()
  if (!needle) return 0
  const label = item.label.toLowerCase()
  if (label === needle) return 300
  if (label.startsWith(needle)) return 200
  if (label.includes(needle)) return 120
  if (item.keywords.toLowerCase().includes(needle)) return 80
  if (item.description.toLowerCase().includes(needle)) return 40
  return navItemMatches(item, needle) ? 20 : 0
}

const NAV_ITEMS: SettingsNavItem[] = [
  {
    id: 'folders',
    label: 'Music folders',
    description: 'Local folders Umbrix Groove indexes for your library.',
    icon: 'folder',
    keywords:
      'music folders library scan path directory add folder rescan all open remove watch music folders live index'
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Look, density, and visual polish.',
    icon: 'palette',
    keywords:
      'appearance theme color gold density ui motion compact density reduce motion umbrix galaxy accent warm gold button tips hover labels tooltips groove tags stars chrome header footer sidebar'
  },
  {
    id: 'warnings',
    label: 'Warning Toggles',
    description: 'Safety prompts you can turn off once you know them.',
    icon: 'warning',
    keywords:
      'warnings warning toggles photosensitivity photosensitive epilepsy flashing strobe visualizer milkdrop safety prompt alert'
  },
  {
    id: 'hotkeys',
    label: 'Keybinds',
    description: 'Keyboard shortcuts for the player and window.',
    icon: 'hotkeys',
    keywords:
      'keybinds hotkeys shortcuts keyboard keys bindings space seek volume media play pause reload relaunch'
  },
  {
    id: 'playback',
    label: 'Playback',
    description: 'How tracks start, stop, and transition.',
    icon: 'play',
    keywords:
      'playback audio volume seek resume position remember seek step volume step crossfade gapless'
  },
  {
    id: 'library',
    label: 'Library',
    description: 'Scanning, sorting, and library hygiene.',
    icon: 'queue',
    keywords:
      'library scan metadata tags index rescan watch folders live artwork cache sorting hygiene'
  },
  {
    id: 'lyrics',
    label: 'Lyrics',
    description: 'Synced lyrics and display preferences.',
    icon: 'lyrics',
    keywords:
      'lyrics lrc sidecar sync karaoke scroll prefer sidecar show stage view auto-scroll'
  },
  {
    id: 'about',
    label: 'About',
    description: 'Version and local-first notes.',
    icon: 'information',
    keywords: 'about information version umbrix credits local-first machine'
  },
  {
    id: 'updates',
    label: 'Updates',
    description: 'Check for new Umbrix Groove builds.',
    icon: 'download',
    keywords: 'updates upgrade version release github install check for updates'
  },
  {
    id: 'changelog',
    label: 'Changelog',
    description: 'What changed in recent Umbrix Groove releases.',
    icon: 'duration',
    keywords: 'changelog release notes history versions whats new ship updates'
  }
]

const HOTKEYS = [
  { keys: 'Space', action: 'Play / Pause' },
  { keys: '← / →', action: 'Seek by step' },
  { keys: '↑ / ↓', action: 'Volume by step' },
  { keys: 'Media keys', action: 'Play / Pause, next, previous (system)' },
  { keys: 'F5 / Ctrl+R', action: 'Reload window' },
  { keys: 'Shift+F5 / Ctrl+Shift+R', action: 'Relaunch app' }
]

/** App settings — sidebar nav with Music folders first. */
export function SettingsModal({
  open,
  onClose,
  focusTarget = null,
  onFocusHandled,
  onEditAppearance
}: SettingsModalProps): React.JSX.Element | null {
  const { folders, scanning, addFolder, rescanAll, rescanFolder, removeFolder, openFolder } =
    useLibrary()
  const { settings, setAppearance, setPlayback, setLibrary, setLyrics, setWarnings } =
    useSettings()
  const [section, setSection] = useState<SettingsSectionId>('folders')
  const [query, setQuery] = useState('')
  const [guideOpen, setGuideOpen] = useState(false)
  const [addFolderHighlight, setAddFolderHighlight] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const addFolderBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    setSection('folders')
    setQuery('')
    setGuideOpen(false)
    if (focusTarget) return
    const focusTimer = window.setTimeout(() => searchInputRef.current?.focus(), 40)
    return () => window.clearTimeout(focusTimer)
  }, [open, focusTarget])

  useEffect(() => {
    if (!open || focusTarget !== 'add-folder') return
    setSection('folders')
    setQuery('')
    setGuideOpen(false)
    const scrollTimer = window.setTimeout(() => {
      addFolderBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setAddFolderHighlight(true)
    }, 80)
    const clearTimer = window.setTimeout(() => {
      setAddFolderHighlight(false)
      onFocusHandled?.()
    }, 3500)
    return () => {
      window.clearTimeout(scrollTimer)
      window.clearTimeout(clearTimer)
    }
  }, [open, focusTarget, onFocusHandled])

  useEffect(() => {
    if (!open || focusTarget !== 'warnings') return
    setSection('warnings')
    setQuery('')
    setGuideOpen(false)
    onFocusHandled?.()
  }, [open, focusTarget, onFocusHandled])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (query.trim()) {
        event.preventDefault()
        setQuery('')
        searchInputRef.current?.focus()
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, query])

  useEffect(() => {
    if (GUIDE_SECTION_IDS.includes(section)) setGuideOpen(true)
  }, [section])

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return NAV_ITEMS
    return NAV_ITEMS.filter((item) => navItemMatches(item, q)).sort(
      (a, b) => scoreNavMatch(b, q) - scoreNavMatch(a, q)
    )
  }, [query])

  const filteredGuideChildren = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return GUIDE_CHILDREN
    const parentHit = navItemMatches(
      { label: GUIDE_PARENT.label, description: '', keywords: GUIDE_PARENT.keywords },
      q
    )
    if (parentHit) return GUIDE_CHILDREN
    return GUIDE_CHILDREN.filter((item) => navItemMatches(item, q)).sort(
      (a, b) => scoreNavMatch(b, q) - scoreNavMatch(a, q)
    )
  }, [query])

  const showGuideGroup = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return filteredGuideChildren.length > 0
  }, [query, filteredGuideChildren])

  const rankedMatches = useMemo(() => {
    const q = query.trim()
    if (!q) return [] as SettingsNavItem[]
    const pool: SettingsNavItem[] = []
    for (const item of filteredNav) pool.push(item)
    for (const child of filteredGuideChildren) {
      if (!pool.some((item) => item.id === child.id)) pool.push(child)
    }
    return [...pool].sort((a, b) => scoreNavMatch(b, q) - scoreNavMatch(a, q))
  }, [query, filteredNav, filteredGuideChildren])

  const matchCount = rankedMatches.length

  useEffect(() => {
    const q = query.trim()
    if (!q || rankedMatches.length === 0) return
    if (rankedMatches.some((item) => item.id === section)) return
    setSection(rankedMatches[0].id)
  }, [query, rankedMatches, section])

  const allSections = useMemo(() => [...NAV_ITEMS, ...GUIDE_CHILDREN], [])
  const active = allSections.find((item) => item.id === section) ?? NAV_ITEMS[0]
  const guideExpanded = guideOpen || Boolean(query.trim())
  const searching = Boolean(query.trim())

  const guideNavGroup = showGuideGroup ? (
    <div className="settings-modal__nav-group">
      <button
        type="button"
        className={`settings-modal__nav-item settings-modal__nav-item--group${
          GUIDE_SECTION_IDS.includes(section) ? ' is-active-group' : ''
        }`}
        aria-expanded={guideExpanded}
        onClick={() => {
          if (guideOpen && section === 'guide-have') {
            setGuideOpen(false)
            return
          }
          setGuideOpen(true)
          setSection('guide-have')
        }}
      >
        <Icon name="queue" size={20} />
        <span>{GUIDE_PARENT.label}</span>
        <span
          className={`settings-modal__nav-caret${guideExpanded ? ' is-open' : ''}`}
          aria-hidden
        />
      </button>
      {guideExpanded ? (
        <div className="settings-modal__nav-children" role="group" aria-label="How to Add Music pages">
          {filteredGuideChildren.map((child) => (
            <button
              key={child.id}
              type="button"
              className={`settings-modal__nav-item settings-modal__nav-item--child${
                section === child.id ? ' is-active' : ''
              }`}
              aria-current={section === child.id ? 'page' : undefined}
              onClick={() => setSection(child.id)}
            >
              <span className="settings-modal__nav-child-rail" aria-hidden />
              <span>{child.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  ) : null

  if (!open) return null

  return (
    <div className="settings-modal" role="presentation" onClick={onClose}>
      <div
        className="settings-modal__panel gold-frame"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalHeader title="Settings" titleId="settings-modal-title" seed={13} onClose={onClose} />

        <div className="settings-modal__body">
          <aside className="settings-modal__nav" aria-label="Settings sections">
            <div className="settings-modal__search">
              <label className="settings-modal__search-field">
                <span className="settings-modal__visually-hidden">Search settings</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    const top = rankedMatches[0]
                    if (!top) return
                    setSection(top.id)
                    if (GUIDE_SECTION_IDS.includes(top.id)) setGuideOpen(true)
                  }}
                  placeholder="Search settings…"
                  autoComplete="off"
                  aria-label="Search settings"
                  aria-controls="settings-nav-list"
                  aria-describedby={searching ? 'settings-search-status' : undefined}
                />
              </label>
              {searching ? (
                <button
                  type="button"
                  className="settings-modal__search-clear"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery('')
                    searchInputRef.current?.focus()
                  }}
                >
                  <Icon name="close" size={14} />
                </button>
              ) : null}
            </div>
            {searching ? (
              <p id="settings-search-status" className="settings-modal__search-status" role="status">
                {matchCount === 0
                  ? 'No matching sections'
                  : `${matchCount} match${matchCount === 1 ? '' : 'es'} — Enter opens the top result`}
              </p>
            ) : null}

            <nav id="settings-nav-list" className="settings-modal__nav-list">
              {filteredNav.length === 0 && !showGuideGroup ? (
                <p className="settings-modal__nav-empty">No matching sections.</p>
              ) : (
                <>
                  {filteredNav.map((item) => (
                    <div key={item.id} className="settings-modal__nav-block">
                      {item.id === 'updates' ? (
                        <div className="settings-modal__nav-sep" role="separator" />
                      ) : null}
                      <button
                        type="button"
                        className={`settings-modal__nav-item${section === item.id ? ' is-active' : ''}`}
                        aria-current={section === item.id ? 'page' : undefined}
                        onClick={() => setSection(item.id)}
                      >
                        <Icon name={item.icon} size={20} />
                        <span>{item.label}</span>
                      </button>
                      {item.id === 'folders' ? guideNavGroup : null}
                    </div>
                  ))}
                  {!filteredNav.some((item) => item.id === 'folders') ? guideNavGroup : null}
                </>
              )}
            </nav>
          </aside>

          <section
            className="settings-modal__content"
            aria-labelledby="settings-section-title"
          >
            <div className="settings-modal__content-head">
              <h3 id="settings-section-title">{active.label}</h3>
              <p>{active.description}</p>
            </div>

            <div className="settings-modal__content-body">
              {section === 'folders' ? (
                <FoldersPane
                  folders={folders}
                  scanning={scanning}
                  watchFolders={settings.library.watchFolders}
                  onWatchFoldersChange={(checked) => setLibrary({ watchFolders: checked })}
                  onAdd={() => void addFolder()}
                  onRescanAll={() => void rescanAll()}
                  onRescan={(id) => void rescanFolder(id)}
                  onOpen={(id) => void openFolder(id)}
                  onRemove={(id) => void removeFolder(id)}
                  addFolderBtnRef={addFolderBtnRef}
                  addFolderHighlight={addFolderHighlight}
                />
              ) : null}

              {section === 'guide-have' ? <MusicGuideHavePane /> : null}
              {section === 'guide-folder' ? <MusicGuideFolderPane /> : null}

              {section === 'appearance' ? (
                <div className="settings-modal__prefs">
                  <p className="settings-modal__hint">
                    Open the live studio to tint UI purple, buttons, and scrollbars while you keep
                    using the app. Gold brand accents stay Umbrix.
                  </p>
                  <div className="settings-modal__actions">
                    <button
                      type="button"
                      className="hero__cta"
                      onClick={() => onEditAppearance?.()}
                    >
                      <span>Edit appearance</span>
                    </button>
                  </div>
                  <ul className="settings-modal__pref-list">
                    <StaticPrefRow
                      label="Theme"
                      value={
                        settings.appearance.themeId === 'custom'
                          ? 'Custom hues'
                          : settings.appearance.themeId.charAt(0).toUpperCase() +
                            settings.appearance.themeId.slice(1)
                      }
                    />
                    <TogglePrefRow
                      label="Compact density"
                      description="Tighter padding in shell chrome."
                      checked={settings.appearance.compactDensity}
                      onChange={(checked) => setAppearance({ compactDensity: checked })}
                    />
                    <TogglePrefRow
                      label="Reduce motion"
                      description="Shorten UI motion and lyrics scroll animation."
                      checked={settings.appearance.reduceMotion}
                      onChange={(checked) => setAppearance({ reduceMotion: checked })}
                    />
                    <TogglePrefRow
                      label="Button tips"
                      description="Show groove hover labels across the player footer, queue, title bar, and other icon controls."
                      checked={settings.appearance.showButtonTips}
                      onChange={(checked) => setAppearance({ showButtonTips: checked })}
                    />
                    <TogglePrefRow
                      label="Galaxy chrome"
                      description="Twinkling Umbrix stars on the title bar, sidebars, and player footer. Home welcome sky stays on either way."
                      checked={settings.appearance.galaxyChrome !== false}
                      onChange={(checked) => setAppearance({ galaxyChrome: checked })}
                    />
                  </ul>
                </div>
              ) : null}

              {section === 'warnings' ? (
                <div className="settings-modal__prefs">
                  <p className="settings-modal__hint">
                    These prompts show once before something potentially intense starts. Turn them
                    off only if you already know the risk.
                  </p>
                  <ul className="settings-modal__pref-list">
                    <TogglePrefRow
                      label="Visualizer photosensitivity warning"
                      description="Ask before opening the music visualizer. Some presets flash, strobe, or shift colors quickly."
                      checked={settings.warnings.showVisualizerPhotosensitivity}
                      onChange={(checked) =>
                        setWarnings({ showVisualizerPhotosensitivity: checked })
                      }
                    />
                  </ul>
                </div>
              ) : null}

              {section === 'hotkeys' ? (
                <div className="settings-modal__hotkeys">
                  <p className="settings-modal__hint">
                    Built-in shortcuts. Seek and volume steps follow Playback settings. Arrow keys
                    switch visualizer presets while Now Playing is open.
                  </p>
                  <ul className="settings-modal__hotkey-list">
                    {HOTKEYS.map((row) => (
                      <li key={row.keys} className="settings-modal__hotkey-row">
                        <kbd>{row.keys}</kbd>
                        <span>{row.action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {section === 'playback' ? (
                <div className="settings-modal__prefs">
                  <p className="settings-modal__hint">
                    Crossfade and gapless stay planned. Resume and keyboard steps land here.
                  </p>
                  <ul className="settings-modal__pref-list">
                    <TogglePrefRow
                      label="Remember position"
                      description="Restore queue and scrub position on launch."
                      checked={settings.playback.rememberPosition}
                      onChange={(checked) => setPlayback({ rememberPosition: checked })}
                    />
                    <SelectPrefRow
                      label="Seek step"
                      description="Arrow left / right jump size."
                      value={String(settings.playback.seekStepSeconds)}
                      options={[
                        { value: '5', label: '5 seconds' },
                        { value: '10', label: '10 seconds' },
                        { value: '15', label: '15 seconds' }
                      ]}
                      onChange={(value) =>
                        setPlayback({ seekStepSeconds: Number(value) as SeekStepSeconds })
                      }
                    />
                    <SelectPrefRow
                      label="Volume step"
                      description="Arrow up / down change size."
                      value={String(settings.playback.volumeStep)}
                      options={[
                        { value: '0.02', label: '2%' },
                        { value: '0.05', label: '5%' },
                        { value: '0.1', label: '10%' }
                      ]}
                      onChange={(value) =>
                        setPlayback({ volumeStep: Number(value) as VolumeStep })
                      }
                    />
                  </ul>
                </div>
              ) : null}

              {section === 'library' ? (
                <div className="settings-modal__prefs">
                  <p className="settings-modal__hint">
                    Live folder watch and folder management live under Music folders.
                  </p>
                  <ul className="settings-modal__pref-list">
                    <StaticPrefRow label="Artwork cache" value="Local" />
                  </ul>
                </div>
              ) : null}

              {section === 'lyrics' ? (
                <div className="settings-modal__prefs">
                  <p className="settings-modal__hint">
                    Local files only. Sidecar and embedded tags never leave this machine.
                  </p>
                  <ul className="settings-modal__pref-list">
                    <TogglePrefRow
                      label="Prefer sidecar .lrc"
                      description="Try files beside the track before embedded tags."
                      checked={settings.lyrics.preferSidecar}
                      onChange={(checked) => setLyrics({ preferSidecar: checked })}
                    />
                    <TogglePrefRow
                      label="Show in stage view"
                      description="Allow the full Lyrics page in the center workspace."
                      checked={settings.lyrics.showInStage}
                      onChange={(checked) => setLyrics({ showInStage: checked })}
                    />
                    <TogglePrefRow
                      label="Auto-scroll sync"
                      description="Keep the active line centered while the track plays."
                      checked={settings.lyrics.autoScroll}
                      onChange={(checked) => setLyrics({ autoScroll: checked })}
                    />
                  </ul>
                </div>
              ) : null}

              {section === 'about' ? <AboutPane /> : null}
              {section === 'changelog' ? <ChangelogPane /> : null}
              {section === 'updates' ? <UpdatesPane /> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to execCommand fallback (common in Electron).
  }

  try {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.left = '-9999px'
    document.body.appendChild(field)
    field.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(field)
    return ok
  } catch {
    return false
  }
}

function CopyUrlBlock({
  url,
  label = 'Copy URL'
}: {
  url: string
  label?: string
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <div className="settings-modal__copy-block">
      <code className={`settings-modal__copy-url${copied ? ' is-copied' : ''}`}>{url}</code>
      <div className="settings-modal__copy-row">
        <button
          type="button"
          className={`settings-modal__copy-btn${copied ? ' is-copied' : ''}`}
          aria-live="polite"
          onClick={() => {
            if (copied) return
            void copyTextToClipboard(url).then((ok) => {
              if (ok) setCopied(true)
            })
          }}
        >
          {copied ? 'Copied to clipboard' : label}
        </button>
      </div>
    </div>
  )
}

function GuideInline({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <span className="settings-modal__guide-inline" title={label} aria-label={label}>
      <span className="settings-modal__guide-inline-frame" aria-hidden>
        {children}
      </span>
    </span>
  )
}

function SampleSettingsIcon(): React.JSX.Element {
  return (
    <GuideInline label="Settings button">
      <span className="settings-modal__sample-icon-btn">
        <Icon name="settings-heart" size={16} />
      </span>
    </GuideInline>
  )
}

function SampleMusicFoldersNav(): React.JSX.Element {
  return (
    <GuideInline label="Music folders tab">
      <span className="settings-modal__nav-item is-active settings-modal__sample-nav">
        <Icon name="folder" size={14} />
        <span>Music folders</span>
      </span>
    </GuideInline>
  )
}

function SampleAddFolderButton(): React.JSX.Element {
  return (
    <GuideInline label="Add Folder button">
      <span className="settings-modal__sample-cta">Add Folder</span>
    </GuideInline>
  )
}

function SampleRescanAllButton(): React.JSX.Element {
  return (
    <GuideInline label="Rescan All button">
      <span className="settings-modal__sample-cta settings-modal__sample-cta--ghost">Rescan All</span>
    </GuideInline>
  )
}

function SampleWatchToggle(): React.JSX.Element {
  return (
    <GuideInline label="Watch music folders toggle">
      <span className="settings-modal__sample-switch-wrap">
        <span>Watch music folders</span>
        <span className="settings-modal__switch is-on" role="presentation">
          <span className="settings-modal__switch-thumb" />
        </span>
      </span>
    </GuideInline>
  )
}

function SampleHowToAddMusicNav(): React.JSX.Element {
  return (
    <GuideInline label="How to Add Music">
      <span className="settings-modal__nav-item is-active settings-modal__sample-nav">
        <Icon name="queue" size={14} />
        <span>How to Add Music</span>
      </span>
    </GuideInline>
  )
}

/** How to add music you already have — Umbrix library walkthrough. */
function MusicGuideHavePane(): React.JSX.Element {
  return (
    <div className="settings-modal__guide">
      <aside className="settings-modal__info-card">
        <h4 className="settings-modal__info-title">1. Open Music Folders</h4>
        <p>
          Click the settings button in the top-right <SampleSettingsIcon />, open{' '}
          <SampleMusicFoldersNav />, then click <SampleAddFolderButton />.
        </p>
      </aside>

      <aside className="settings-modal__info-card">
        <h4 className="settings-modal__info-title">2. Choose Your Music Folder</h4>
        <p>
          Select the folder on your PC that already contains your music files. Umbrix Groove
          indexes that folder and its subfolders in place; it does not copy or upload your music.
        </p>
      </aside>

      <aside className="settings-modal__info-card">
        <h4 className="settings-modal__info-title">3. Supported Audio Formats</h4>
        <p>
          <strong>Audio:</strong> {AUDIO_FORMAT_LABEL}
        </p>
      </aside>

      <aside className="settings-modal__info-card">
        <h4 className="settings-modal__info-title">4. Music Tags</h4>
        <p>
          Title, artist, album, year, and genre come from your files&apos; metadata. Properly tagged
          files make your library easier to organize and improve sorting and Now Playing details.
        </p>
      </aside>

      <aside className="settings-modal__info-card">
        <h4 className="settings-modal__info-title">5. Album Art</h4>
        <p>
          For the best results, use music files with embedded album artwork. Umbrix Groove can read
          that artwork when indexing supported files and display it in your library, playlists, and
          player.
        </p>
      </aside>

      <aside className="settings-modal__info-card">
        <h4 className="settings-modal__info-title">6. Lyrics</h4>
        <p>
          Place a matching <code>.lrc</code>, <code>.txt</code>, or <code>.lyrics</code> file beside
          the track using the same filename, or embed lyrics in the file&apos;s metadata if supported.
          Synchronized <code>.lrc</code> files can display lyrics line by line during playback.
        </p>
      </aside>

      <aside className="settings-modal__info-card">
        <h4 className="settings-modal__info-title">7. Keep Your Library Updated</h4>
        <p>
          Enable <SampleWatchToggle /> in the Music folders tab to detect new or changed files while
          the app is open.
        </p>
        <p>
          You can also right-click <strong>All Songs</strong> in the left sidebar and select{' '}
          <strong>Rescan Library</strong>, or use <SampleRescanAllButton /> in Music folders.
        </p>
      </aside>
    </div>
  )
}

/** Where to buy music legally — downloadable purchases that Umbrix Groove can index. */


function MusicGuideFolderPane(): React.JSX.Element {
  return (
    <div className="settings-modal__guide">
      {/* Mornye downloading guide */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600 }}>
          Guide to Downloading Music with Mornye
        </h3>

        <p style={{ margin: 0, lineHeight: 1.6 }}>
          Don't have any music files yet? You can use Mornye to find and
          download music, then organize it into a local folder that Umbrix
          Groove can read. Follow the instructions below to get started.
        </p>

        <aside className="settings-modal__info-card">
          <h4 className="settings-modal__info-title">
            Method 1: Add Music You Already Have
          </h4>
          <p>
            If you already have music files on your PC, you do not need Mornye.
            Open Umbrix Groove&apos;s settings <SampleSettingsIcon />, go to{' '}
            <SampleMusicFoldersNav />, click <SampleAddFolderButton />, and select the folder
            containing your music.
          </p>
        </aside>

        <aside className="settings-modal__info-card">
          <h4 className="settings-modal__info-title">
            Method 2: Download Music Using Mornye
          </h4>
          <p>
            Ready to fill your music library? Mornye can help you find and
            download music from various sources and organize it into a local
            folder that Umbrix Groove can read.
          </p>
          <p>
            <strong>A little disclaimer: this is the naughty method.</strong>{" "}
            Downloading copyrighted music without permission or a license can
            be considered piracy and may be illegal. Think of the old-school
            days of LimeWire or burning CDs for your friends without buying
            the original albums. Nostalgic? Absolutely. Legally questionable?
            Potentially!
          </p>
          <p>
            Copyright laws and the rules of each music service vary, so make
            sure you have the right to download the music you choose. With
            that said, the following guide explains how to set up Mornye and
            add your downloaded music to Umbrix Groove.
          </p>
        </aside>

        <aside className="settings-modal__info-card">
          <h4 className="settings-modal__info-title">1. Download Mornye</h4>
          <p>
            Visit the following page to download Mornye:
          </p>
          <p>
            <a
              href="https://spotiflac.com/downloads#desktop-release"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download Mornye
            </a>
          </p>
          <p>
            If you're using Windows, select the <strong>Windows installer</strong>.
            Follow the installation instructions, then open the app.
          </p>
        </aside>


        <aside className="settings-modal__info-card">
  <h4 className="settings-modal__info-title">
    2. Add the Official Mornye Registry
  </h4>

  <p>
    In Mornye, click the <strong>Repo</strong> button to manage your
    extension repositories. Follow these steps to add the official registry.
  </p>

  <p>
    <strong>Step 1:</strong> Copy the registry URL below.
  </p>

  <CopyUrlBlock
    label="Copy Registry URL"
    url="https://raw.githubusercontent.com/mornyeapp/Mornye-Extension/main/registry.json"
  />

  <p>
    <strong>Step 2:</strong> Return to Mornye, open <strong>Repo</strong>,
    and paste the copied URL into the repository field. Follow the
    instructions in Mornye to add the registry.
  </p>

  <p>
    Need help? Read the official instructions here:
  </p>

  <p>
    <a
      href="https://spotiflac.com/extension#add-repo"
      target="_blank"
      rel="noopener noreferrer"
    >
      Open Official Mornye Registry Instructions
    </a>
  </p>

  <p>
    Once the registry has been added successfully, you should be able
    to browse the available music source extensions.
  </p>
</aside>


        <aside className="settings-modal__info-card">
          <h4 className="settings-modal__info-title">3. Choose Your Music Sources</h4>
          <p>
            Mornye provides extensions for searching different music services.
            I personally use <strong>Spotify Web</strong>,{" "}
            <strong>Amazon Music</strong>, and <strong>YouTube Music</strong>.
            Select the sources you want to use from the available extensions.
          </p>
          <p>
            The available sources and their features may vary depending on
            the extensions you install.
          </p>
        </aside>

        <aside className="settings-modal__info-card">
          <h4 className="settings-modal__info-title">
            4. Download a Spotify Playlist
          </h4>
          <p>
            To download a Spotify playlist, make sure it is set to{" "}
            <strong>Public</strong> rather than Private. Copy the URL of the
            public playlist you want to download.
          </p>
          <p>
            In Mornye, click the small magnifying-glass icon with the
            downward-facing arrow beside the search bar. This opens the source
            selector, where you can choose <strong>Spotify Web</strong>.
          </p>
          <p>
            Paste the playlist URL into the search bar and select the download
            option. You can use the same source selector to switch between
            other music services you have installed.
          </p>
        </aside>

        <aside className="settings-modal__info-card">
          <h4 className="settings-modal__info-title">
            5. Complete Human Verification When Prompted
          </h4>
          <p>
            Mornye may occasionally ask you to verify that you're human before
            downloads can continue. If a verification prompt appears, open the
            verification page in your browser and complete the requested steps.
          </p>
          <p>
            Once verification is complete, return to Mornye. Downloads should
            resume if verification was successful. The frequency of these
            prompts can vary.
          </p>
        </aside>

        <aside className="settings-modal__info-card">
          <h4 className="settings-modal__info-title">6. Find Your Downloaded Music</h4>
          <p>
            Once your downloads are complete, locate the folder where Mornye
            saves your music. In my setup, this is the <strong>Mornye</strong>{" "}
            folder inside my music folder. Your location may differ depending
            on your download settings.
          </p>
        </aside>

        <aside className="settings-modal__info-card">
          <h4 className="settings-modal__info-title">
            7. Add Mornye&apos;s Folder to Umbrix Groove
          </h4>
          <p>
            Open Umbrix Groove and click the settings button in the top-right{' '}
            <SampleSettingsIcon />, go to <SampleMusicFoldersNav />, click{' '}
            <SampleAddFolderButton />, and select the folder where Mornye saves your downloaded
            music.
          </p>
          <p>
            After adding the folder, allow Umbrix Groove to index your files.
            Your downloaded tracks should then appear in your music library.
          </p>
        </aside>

        <aside className="settings-modal__info-card">
          <h4 className="settings-modal__info-title">Why I Recommend Mornye</h4>
          <p>
            I use Mornye because it can provide music files with useful
            metadata, including artist names, album names, release years,
            lyrics, and album artwork when available. This information helps
            Umbrix Groove display your library more accurately and makes the
            app look better.
          </p>
          <p>
            Metadata and artwork availability depend on the source and the
            files you download. If some information is missing, you may need
            to add or correct it yourself.
          </p>
        </aside>
      </div>
    </div>
  );
}



type FoldersPaneProps = {
  folders: LibraryFolder[]
  scanning: boolean
  watchFolders: boolean
  onWatchFoldersChange: (checked: boolean) => void
  onAdd: () => void
  onRescanAll: () => void
  onRescan: (id: string) => void
  onOpen: (id: string) => void
  onRemove: (id: string) => void
  addFolderBtnRef: React.RefObject<HTMLButtonElement | null>
  addFolderHighlight: boolean
}

function FoldersPane({
  folders,
  scanning,
  watchFolders,
  onWatchFoldersChange,
  onAdd,
  onRescanAll,
  onRescan,
  onOpen,
  onRemove,
  addFolderBtnRef,
  addFolderHighlight
}: FoldersPaneProps): React.JSX.Element {
  return (
    <div className="settings-modal__folders">
      <aside className="settings-modal__info-card" aria-label="How to add music to Umbrix Groove">
        <h4 className="settings-modal__info-title">How to add music to Umbrix Groove</h4>
        <p>
          Add a folder that already holds your music files. Umbrix Groove indexes that folder (and
          its subfolders) — it does not copy or upload anything.
        </p>
        <p>
          <strong>Audio it can read:</strong> {AUDIO_FORMAT_LABEL}
        </p>
        <p>
          <strong>Album art:</strong> use embedded cover art in the tags (most rippers and download
          tools write this). Umbrix Groove reads that picture when it indexes the track.
        </p>
        <p>
          <strong>Lyrics:</strong> put a matching <code>.lrc</code> (or <code>.txt</code> /{' '}
          <code>.lyrics</code>) beside the track with the same name, or embed lyrics in the tags.
          Synced <code>.lrc</code> files light up line-by-line while playing.
        </p>
        <p>
          <strong>Tags:</strong> title, artist, album, year, and genre come from the file metadata.
          Cleaner tags mean a cleaner library. For the full walkthrough, open{' '}
          <SampleHowToAddMusicNav /> in the sidebar.
        </p>
      </aside>

      <div className="settings-modal__folders-prefs">
        <p className="settings-modal__folders-prefs-label">Options</p>
        <ul className="settings-modal__pref-list">
          <TogglePrefRow
            label="Watch music folders"
            description="Live update when you drop or move files into any music folder."
            checked={watchFolders}
            onChange={onWatchFoldersChange}
          />
        </ul>
      </div>

      <div className="settings-modal__actions">
        <button
          ref={addFolderBtnRef}
          type="button"
          id="settings-add-folder"
          className={`hero__cta${addFolderHighlight ? ' settings-modal__add-folder--pulse' : ''}`}
          onClick={onAdd}
        >
          Add Folder
        </button>
        <button
          type="button"
          className="hero__cta hero__cta--ghost"
          onClick={onRescanAll}
          disabled={folders.length === 0 || scanning}
        >
          Rescan All
        </button>
      </div>

      <div className="settings-modal__list">
        {folders.length === 0 ? (
          <p className="settings-modal__empty">No folders yet. Add one to begin indexing.</p>
        ) : (
          folders.map((folder) => (
            <div key={folder.id} className="settings-modal__row">
              <div className="settings-modal__row-main">
                <Icon name="folder" size={18} />
                <div>
                  <strong title={folder.path}>{folder.path}</strong>
                  <span>
                    {folder.trackCount} songs
                    {folder.lastScannedAt
                      ? ` · scanned ${new Date(folder.lastScannedAt).toLocaleString()}`
                      : ' · not scanned yet'}
                  </span>
                </div>
              </div>
              <div className="settings-modal__row-actions">
                <button type="button" onClick={() => onOpen(folder.id)}>
                  Open folder
                </button>
                <button type="button" onClick={() => onRescan(folder.id)} disabled={scanning}>
                  Rescan
                </button>
                <button type="button" onClick={() => onRemove(folder.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function StaticPrefRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <li className="settings-modal__pref-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </li>
  )
}

type TogglePrefRowProps = {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function TogglePrefRow({
  label,
  description,
  checked,
  onChange
}: TogglePrefRowProps): React.JSX.Element {
  const id = `settings-toggle-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <li className="settings-modal__pref-row settings-modal__pref-row--control">
      <div className="settings-modal__pref-copy">
        <label htmlFor={id}>{label}</label>
        <span>{description}</span>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className={`settings-modal__switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="settings-modal__switch-thumb" />
      </button>
    </li>
  )
}

function AboutPane(): React.JSX.Element {
  const [version, setVersion] = useState('…')

  useEffect(() => {
    if (!window.api?.app?.getVersion) {
      setVersion('0.1.0')
      return
    }
    void window.api.app.getVersion().then(setVersion).catch(() => setVersion('0.1.0'))
  }, [])

  return (
    <div className="settings-modal__about settings-modal__about--credits">
      <div className="settings-modal__about-intro">
        <div className="settings-modal__about-title-row">
          <p className="settings-modal__about-brand" aria-label="Umbrix Groove">
            <span className="settings-modal__about-brand-umbrix">Umbrix</span>
            <span className="settings-modal__about-brand-groove">Groove</span>
          </p>
          <p className="settings-modal__about-version">v{version}</p>
        </div>
        <p className="settings-modal__about-story">
          I got sick of paying companies to be able to listen to music, so I made this program
          where I can put all of my music in one place and listen to it offline like the good
          ole Windows Media Player days. I hate using subscription services just to hear nice
          sounds. I miss MP3s and CDs and shit.
          {'\n\n'}
          Anyway that&apos;s why this exists, enjoy.
        </p>
      </div>
      <aside className="settings-modal__plaque" aria-label="Credits plaque">
        <GalaxySky variant="chrome" seed={27} />
        <span className="settings-modal__plaque-rivet" aria-hidden />
        <span className="settings-modal__plaque-rivet" aria-hidden />
        <span className="settings-modal__plaque-rivet" aria-hidden />
        <span className="settings-modal__plaque-rivet" aria-hidden />
        <div className="settings-modal__plaque-copy">
          <p className="settings-modal__plaque-title">My hams</p>
          <p className="settings-modal__plaque-kicker">5/7/26 – 10/27/2026</p>
          <p className="settings-modal__plaque-epitaph">
            In loving memory of my hams;
            <br />
            rest in arthritis and carpal tunnel.
          </p>
        </div>
      </aside>
    </div>
  )
}

function ChangelogPane(): React.JSX.Element {
  const [readEntry, setReadEntry] = useState<(typeof CHANGELOG)[number] | null>(null)

  return (
    <div className="settings-modal__changelog">
      <p className="settings-modal__hint">
        Recent packaged releases, newest first. Open a log anytime. The what&apos;s-new modal also
        appears once after you update.
      </p>
      <ol className="settings-modal__changelog-list">
        {CHANGELOG.map((entry) => (
          <li key={entry.version} className="settings-modal__changelog-entry gold-frame">
            <div className="settings-modal__changelog-entry-top">
              <GalaxySky variant="chrome" seed={23} />
              <p className="settings-modal__changelog-kicker">What&apos;s new</p>
              <span className="settings-modal__changelog-version">{entry.version}</span>
            </div>
            <div className="settings-modal__changelog-entry-body">
              <div className="settings-modal__changelog-card">
                <p className="settings-modal__changelog-summary">{entry.summary}</p>
              </div>
            </div>
            <div className="settings-modal__changelog-entry-foot">
              <button
                type="button"
                className="ug-modal__btn ug-modal__btn--solid settings-modal__changelog-read"
                onClick={() => setReadEntry(entry)}
              >
                Click to read log
              </button>
            </div>
          </li>
        ))}
      </ol>
      <ChangelogDialog entry={readEntry} onDismiss={() => setReadEntry(null)} />
    </div>
  )
}

const UPDATE_FAILED_NOTE = 'Update failed.\n\nPlease try again later.'

function UpdatesPane(): React.JSX.Element {
  const [version, setVersion] = useState('…')
  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateNote, setUpdateNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(
    null
  )

  useEffect(() => {
    if (!window.api?.app?.getVersion) {
      setVersion('0.1.0')
      return
    }
    void window.api.app.getVersion().then(setVersion).catch(() => setVersion('0.1.0'))
  }, [])

  return (
    <div className="settings-modal__about">
      <p className="settings-modal__about-heading">Updates</p>
      <p>Installed version {version}</p>
      <p className="settings-modal__hint">
        Umbrix Groove will check for updates on launch. You can check here if there are any
        updates. Otherwise Umbrix Groove will update when you next launch the application.
      </p>
      <div className="settings-modal__update-cta">
        <div className="settings-modal__update-cta-copy">
          <p className="settings-modal__update-cta-title">Check for updates</p>
          <p className="settings-modal__update-cta-sub">
            Look for a newer Umbrix Groove build right now.
          </p>
        </div>
        <button
          type="button"
          className="ug-modal__btn ug-modal__btn--solid settings-modal__update-cta-btn"
          disabled={updateBusy || !window.api?.app?.checkForUpdates}
          onClick={() => {
            if (!window.api?.app?.checkForUpdates) return
            setUpdateBusy(true)
            setUpdateNote(null)
            void window.api.app
              .checkForUpdates()
              .then((result) => {
                if (result.status === 'error') {
                  setUpdateNote({ tone: 'error', text: UPDATE_FAILED_NOTE })
                  return
                }
                setUpdateNote({ tone: 'info', text: result.message })
              })
              .catch(() => setUpdateNote({ tone: 'error', text: UPDATE_FAILED_NOTE }))
              .finally(() => setUpdateBusy(false))
          }}
        >
          {updateBusy ? 'Checking…' : 'Check now'}
        </button>
      </div>
      {updateNote ? (
        <p
          className={
            updateNote.tone === 'error'
              ? 'settings-modal__update-error'
              : 'settings-modal__hint'
          }
          role={updateNote.tone === 'error' ? 'alert' : undefined}
        >
          {updateNote.text}
        </p>
      ) : null}
    </div>
  )
}

type SelectPrefRowProps = {
  label: string
  description: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

function SelectPrefRow({
  label,
  description,
  value,
  options,
  onChange
}: SelectPrefRowProps): React.JSX.Element {
  const id = `settings-select-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <li className="settings-modal__pref-row settings-modal__pref-row--control">
      <div className="settings-modal__pref-copy">
        <label htmlFor={id}>{label}</label>
        <span>{description}</span>
      </div>
      <select
        id={id}
        className="settings-modal__select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </li>
  )
}
