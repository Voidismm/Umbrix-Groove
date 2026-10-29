import { useEffect, useMemo, useState } from 'react'
import { AUDIO_EXTENSIONS } from '@shared/constants'
import type { LibraryFolder } from '@shared/types'
import { useLibrary } from '@renderer/features/library'
import {
  useSettings,
  type SeekStepSeconds,
  type VolumeStep
} from '@renderer/features/settings'
import { Icon } from '../ui/Icon'
import './SettingsModal.css'

const AUDIO_FORMAT_LABEL = AUDIO_EXTENSIONS.map((ext) => `.${ext}`).join(', ')

type SettingsModalProps = {
  open: boolean
  onClose: () => void
}

type SettingsSectionId =
  | 'folders'
  | 'appearance'
  | 'hotkeys'
  | 'playback'
  | 'library'
  | 'lyrics'
  | 'about'
  | 'updates'

type SettingsNavItem = {
  id: SettingsSectionId
  label: string
  description: string
  icon: string
  keywords: string
}

const NAV_ITEMS: SettingsNavItem[] = [
  {
    id: 'folders',
    label: 'Music folders',
    description: 'Local folders Umbrix Groove indexes for your library.',
    icon: 'folder',
    keywords: 'music folders library scan path directory'
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Look, density, and visual polish.',
    icon: 'palette',
    keywords: 'appearance theme color gold density ui motion'
  },
  {
    id: 'hotkeys',
    label: 'Hotkeys',
    description: 'Keyboard shortcuts for the player and window.',
    icon: 'edit',
    keywords: 'hotkeys shortcuts keyboard keys bindings'
  },
  {
    id: 'playback',
    label: 'Playback',
    description: 'How tracks start, stop, and transition.',
    icon: 'play',
    keywords: 'playback audio volume seek resume position'
  },
  {
    id: 'library',
    label: 'Library',
    description: 'Scanning, sorting, and library hygiene.',
    icon: 'queue',
    keywords: 'library scan metadata tags index rescan watch folders live'
  },
  {
    id: 'lyrics',
    label: 'Lyrics',
    description: 'Synced lyrics and display preferences.',
    icon: 'lyrics',
    keywords: 'lyrics lrc sidecar sync karaoke scroll'
  },
  {
    id: 'about',
    label: 'About',
    description: 'Version and local-first notes.',
    icon: 'star',
    keywords: 'about version umbrix credits'
  },
  {
    id: 'updates',
    label: 'Updates',
    description: 'Check for and install new Groove builds.',
    icon: 'download',
    keywords: 'updates upgrade version release github install check'
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
export function SettingsModal({ open, onClose }: SettingsModalProps): React.JSX.Element | null {
  const { folders, scanning, addFolder, rescanAll, rescanFolder, removeFolder, openFolder } =
    useLibrary()
  const { settings, setAppearance, setPlayback, setLibrary, setLyrics } = useSettings()
  const [section, setSection] = useState<SettingsSectionId>('folders')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    setSection('folders')
    setQuery('')
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return NAV_ITEMS
    return NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keywords.includes(q)
    )
  }, [query])

  const active = NAV_ITEMS.find((item) => item.id === section) ?? NAV_ITEMS[0]

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
        <header className="settings-modal__header">
          <div className="settings-modal__header-text">
            <p className="settings-modal__eyebrow">Umbrix Groove</p>
            <h2 id="settings-modal-title">Settings</h2>
          </div>
          <button
            type="button"
            className="settings-modal__close"
            aria-label="Close settings"
            onClick={onClose}
          >
            <Icon name="close" size={16} />
          </button>
        </header>

        <div className="settings-modal__body">
          <aside className="settings-modal__nav" aria-label="Settings sections">
            <label className="settings-modal__search">
              <span className="settings-modal__visually-hidden">Search settings</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search settings…"
                autoComplete="off"
                aria-label="Search settings"
              />
            </label>

            <nav className="settings-modal__nav-list">
              {filteredNav.length === 0 ? (
                <p className="settings-modal__nav-empty">No matching sections.</p>
              ) : (
                filteredNav.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`settings-modal__nav-item${section === item.id ? ' is-active' : ''}`}
                    aria-current={section === item.id ? 'page' : undefined}
                    onClick={() => setSection(item.id)}
                  >
                    <Icon name={item.icon} size={16} />
                    <span>{item.label}</span>
                  </button>
                ))
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
                />
              ) : null}

              {section === 'appearance' ? (
                <div className="settings-modal__prefs">
                  <p className="settings-modal__hint">
                    Gold rim, amethyst panels, and Cinzel brand stay locked to Umbrix Night.
                  </p>
                  <ul className="settings-modal__pref-list">
                    <StaticPrefRow label="Theme" value="Umbrix Night" />
                    <StaticPrefRow label="Accent" value="Warm gold" />
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
              {section === 'updates' ? <UpdatesPane /> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
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
  onRemove
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
          <strong>Tags:</strong> title, artist, album, year, and genre come from the file metadata. Cleaner tags mean a cleaner library.
          <p></p>
           <a href="https://spotiflac.com/" target="_blank" rel="noopener noreferrer">Spotiflac</a> is a good place to get what you need music-wise. It has all of the data, album art, lyrics, and more.
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
        <button type="button" className="hero__cta" onClick={onAdd}>
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
    <div className="settings-modal__about">
      <p className="settings-modal__about-brand">Umbrix Groove</p>
      <p>Version {version}</p>
      <p className="settings-modal__hint">
        Local-first desktop player. Your library stays on this machine.
      </p>
    </div>
  )
}

function UpdatesPane(): React.JSX.Element {
  const [version, setVersion] = useState('…')
  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateNote, setUpdateNote] = useState<string | null>(null)

  useEffect(() => {
    if (!window.api?.app?.getVersion) {
      setVersion('0.1.0')
      return
    }
    void window.api.app.getVersion().then(setVersion).catch(() => setVersion('0.1.0'))
  }, [])

  return (
    <div className="settings-modal__about">
      <p className="settings-modal__about-brand">Updates</p>
      <p>Installed version {version}</p>
      <p className="settings-modal__hint">
        Groove checks{' '}
        <a
          href="https://github.com/Voidismm/Umbrix-Groove/releases"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub Releases
        </a>{' '}
        on launch. You can also check here anytime — if a build is waiting, the install
        prompt appears in-app.
      </p>
      <button
        type="button"
        className="settings-modal__about-update"
        disabled={updateBusy || !window.api?.app?.checkForUpdates}
        onClick={() => {
          if (!window.api?.app?.checkForUpdates) return
          setUpdateBusy(true)
          setUpdateNote(null)
          void window.api.app
            .checkForUpdates()
            .then((result) => setUpdateNote(result.message))
            .catch((err) =>
              setUpdateNote(err instanceof Error ? err.message : String(err))
            )
            .finally(() => setUpdateBusy(false))
        }}
      >
        {updateBusy ? 'Checking…' : 'Check for updates'}
      </button>
      {updateNote ? <p className="settings-modal__hint">{updateNote}</p> : null}
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
