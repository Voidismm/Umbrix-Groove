import { useEffect, useRef, useState } from 'react'
import { appearanceTheme, themeToFlat, useSettings } from '@renderer/features/settings'
import {
  applyAppearanceHues,
  channelSwatch,
  findThemeId,
  savedThemeId,
  THEME_PRESETS,
  type ChannelTone,
  type ThemeHues,
  type ThemePreset
} from '@renderer/features/settings/themePresets'
import { GalaxySky } from '../ui/GalaxySky'
import { Icon } from '../ui/Icon'
import './AppearanceEditor.css'

type AppearanceEditorProps = {
  open: boolean
  onClose: () => void
}

type Draft = ThemeHues & { themeId: string }
type ChannelKey = 'ui' | 'button' | 'scrollbar'

const CHANNELS: Array<{ key: ChannelKey; label: string }> = [
  { key: 'ui', label: 'UI' },
  { key: 'button', label: 'Buttons' },
  { key: 'scrollbar', label: 'Scrollbars' }
]

/** Floating condensed appearance studio — live preview while you browse the app. */
export function AppearanceEditor({ open, onClose }: AppearanceEditorProps): React.JSX.Element | null {
  const { settings, setAppearance } = useSettings()
  const [draft, setDraft] = useState<Draft>(() => snapshot(settings.appearance))
  const [openChannel, setOpenChannel] = useState<ChannelKey | null>(null)
  const [naming, setNaming] = useState(false)
  const [themeName, setThemeName] = useState('')
  const [pos, setPos] = useState({ x: 0, y: 72 })
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  )
  const panelRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const placedRef = useRef(false)
  const savedThemes = settings.appearance.savedThemes

  useEffect(() => {
    if (!open) {
      placedRef.current = false
      setOpenChannel(null)
      setNaming(false)
      setThemeName('')
      return
    }
    // Sync draft only when the studio opens — do not clobber live theme picks
    // if settings.appearance identity churns while the panel is up.
    setDraft(snapshot(settings.appearance))
    if (!placedRef.current) {
      placedRef.current = true
      const width = 320
      const x = Math.max(16, window.innerWidth - width - 28)
      setPos({ x, y: 72 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally open-only
  }, [open])

  useEffect(() => {
    if (!naming) return
    nameInputRef.current?.focus()
    nameInputRef.current?.select()
  }, [naming])

  useEffect(() => {
    if (!open) return
    applyAppearanceHues(draft)
  }, [open, draft])

  useEffect(() => {
    if (!open) return
    const onMove = (event: PointerEvent): void => {
      const drag = dragRef.current
      if (!drag) return
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      setPos({
        x: Math.min(window.innerWidth - 80, Math.max(8, drag.origX + dx)),
        y: Math.min(window.innerHeight - 80, Math.max(8, drag.origY + dy))
      })
    }
    const onUp = (): void => {
      dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [open])

  useEffect(() => {
    if (!openChannel) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (!target) return
      if (panelRef.current?.contains(target)) return
      setOpenChannel(null)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpenChannel(null)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [openChannel])

  if (!open) return null

  const saved = appearanceTheme(settings.appearance)
  const dirty =
    draft.ui.hue !== saved.ui.hue ||
    draft.ui.brightness !== saved.ui.brightness ||
    draft.ui.saturation !== saved.ui.saturation ||
    draft.button.hue !== saved.button.hue ||
    draft.button.brightness !== saved.button.brightness ||
    draft.button.saturation !== saved.button.saturation ||
    draft.scrollbar.hue !== saved.scrollbar.hue ||
    draft.scrollbar.brightness !== saved.scrollbar.brightness ||
    draft.scrollbar.saturation !== saved.scrollbar.saturation ||
    draft.themeId !== settings.appearance.themeId

  const revertAndClose = (): void => {
    applyAppearanceHues(saved)
    onClose()
  }

  const save = (): void => {
    setAppearance({
      ...themeToFlat(draft),
      themeId: draft.themeId
    })
    onClose()
  }

  const setTheme = (hues: ThemeHues, themeId?: string): void => {
    const next: Draft = {
      ui: { hue: hues.ui.hue, brightness: hues.ui.brightness, saturation: hues.ui.saturation },
      button: {
        hue: hues.button.hue,
        brightness: hues.button.brightness,
        saturation: hues.button.saturation
      },
      scrollbar: {
        hue: hues.scrollbar.hue,
        brightness: hues.scrollbar.brightness,
        saturation: hues.scrollbar.saturation
      },
      themeId: themeId ?? findThemeId(hues, savedThemes)
    }
    // Apply immediately so stock Umbrix clears inline overrides even if draft
    // was already the same values (React would skip the draft effect).
    applyAppearanceHues(next)
    setDraft(next)
  }

  const patchChannel = (key: ChannelKey, patch: Partial<ChannelTone>): void => {
    setTheme({
      ui: draft.ui,
      button: draft.button,
      scrollbar: draft.scrollbar,
      [key]: { ...draft[key], ...patch }
    })
  }

  const beginSaveTheme = (): void => {
    setThemeName('')
    setNaming(true)
    setOpenChannel(null)
  }

  const commitSaveTheme = (): void => {
    const name = themeName.trim().slice(0, 40)
    if (!name) return
    const id = savedThemeId(name)
    const preset: ThemePreset = {
      id,
      name,
      ui: { ...draft.ui },
      button: { ...draft.button },
      scrollbar: { ...draft.scrollbar }
    }
    const nextSaved = [...savedThemes.filter((theme) => theme.id !== id), preset]
    setDraft({ ...draft, themeId: id })
    setAppearance({
      ...themeToFlat(draft),
      themeId: id,
      savedThemes: nextSaved
    })
    setNaming(false)
    setThemeName('')
  }

  const deleteSavedTheme = (id: string): void => {
    const nextSaved = savedThemes.filter((theme) => theme.id !== id)
    const nextId = draft.themeId === id ? findThemeId(draft, nextSaved) : draft.themeId
    if (draft.themeId === id) {
      setDraft({ ...draft, themeId: nextId })
    }
    setAppearance({
      savedThemes: nextSaved,
      ...(draft.themeId === id ? { themeId: nextId } : {})
    })
  }

  return (
    <div
      ref={panelRef}
      className="appearance-editor gold-frame"
      role="dialog"
      aria-label="Appearance editor"
      style={{ left: pos.x, top: pos.y }}
    >
      <header
        className="appearance-editor__head"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('button')) return
          dragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            origX: pos.x,
            origY: pos.y
          }
        }}
      >
        <GalaxySky variant="chrome" seed={41} />
        <div className="appearance-editor__titles">
          <p className="appearance-editor__kicker">Live studio</p>
          <h2>Appearance</h2>
        </div>
        <button
          type="button"
          className="appearance-editor__close"
          aria-label="Close appearance editor"
          onClick={revertAndClose}
        >
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className="appearance-editor__body">
        <p className="appearance-editor__hint">
          Drag this panel. Open a swatch to tune hue, brightness, and saturation live.
        </p>

        <p className="appearance-editor__label">Themes</p>
        <div className="appearance-editor__themes" role="listbox" aria-label="Theme presets">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              role="option"
              aria-selected={draft.themeId === preset.id}
              className={`appearance-editor__theme${draft.themeId === preset.id ? ' is-active' : ''}`}
              style={{ ['--theme-swatch' as string]: channelSwatch(preset.ui) }}
              onClick={() => {
                setOpenChannel(null)
                setTheme(preset, preset.id)
              }}
            >
              <span className="appearance-editor__theme-swatch" aria-hidden />
              {preset.name}
            </button>
          ))}
          {savedThemes.map((preset) => (
            <span
              key={preset.id}
              className={`appearance-editor__theme-chip${draft.themeId === preset.id ? ' is-active' : ''}`}
            >
              <button
                type="button"
                role="option"
                aria-selected={draft.themeId === preset.id}
                className="appearance-editor__theme appearance-editor__theme--saved"
                style={{ ['--theme-swatch' as string]: channelSwatch(preset.ui) }}
                onClick={() => {
                  setOpenChannel(null)
                  setTheme(preset, preset.id)
                }}
              >
                <span className="appearance-editor__theme-swatch" aria-hidden />
                {preset.name}
              </button>
              <button
                type="button"
                className="appearance-editor__theme-delete"
                aria-label={`Delete ${preset.name}`}
                title={`Delete ${preset.name}`}
                onClick={() => deleteSavedTheme(preset.id)}
              >
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
          {draft.themeId === 'custom' ? (
            <span className="appearance-editor__theme is-custom" aria-current="true">
              Custom
            </span>
          ) : null}
        </div>

        {naming ? (
          <div className="appearance-editor__save-theme">
            <label className="appearance-editor__save-theme-field">
              <span>Theme name</span>
              <input
                ref={nameInputRef}
                type="text"
                maxLength={40}
                value={themeName}
                aria-label="Theme name"
                onChange={(event) => setThemeName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitSaveTheme()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setNaming(false)
                    setThemeName('')
                  }
                }}
              />
            </label>
            <div className="appearance-editor__save-theme-actions">
              <button
                type="button"
                className="appearance-editor__btn appearance-editor__btn--ghost"
                onClick={() => {
                  setNaming(false)
                  setThemeName('')
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="appearance-editor__btn appearance-editor__btn--solid"
                disabled={!themeName.trim()}
                onClick={commitSaveTheme}
              >
                Save theme
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="appearance-editor__save-theme-btn"
            onClick={beginSaveTheme}
          >
            Save theme…
          </button>
        )}

        <p className="appearance-editor__label">Channels</p>
        <div className="appearance-editor__channels">
          {CHANNELS.map(({ key, label }) => {
            const tone = draft[key]
            const expanded = openChannel === key
            return (
              <div key={key} className={`appearance-editor__channel${expanded ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="appearance-editor__channel-btn"
                  aria-expanded={expanded}
                  aria-controls={`appearance-picker-${key}`}
                  onClick={() => setOpenChannel(expanded ? null : key)}
                >
                  <span
                    className="appearance-editor__channel-swatch"
                    style={{ background: channelSwatch(tone) }}
                    aria-hidden
                  />
                  <span className="appearance-editor__channel-copy">
                    <strong>{label}</strong>
                    <span>
                      {tone.hue}° · {tone.brightness}% · {tone.saturation}%
                    </span>
                  </span>
                  <Icon name="dropdown" className="appearance-editor__channel-chevron" size={32} />
                </button>

                {expanded ? (
                  <div
                    id={`appearance-picker-${key}`}
                    className="appearance-editor__picker"
                    role="group"
                    aria-label={`${label} color`}
                  >
                    <HueSlider
                      label="Hue"
                      value={tone.hue}
                      onChange={(hue) => patchChannel(key, { hue })}
                    />
                    <ToneSlider
                      label="Brightness"
                      value={tone.brightness}
                      onChange={(brightness) => patchChannel(key, { brightness })}
                    />
                    <ToneSlider
                      label="Saturation"
                      value={tone.saturation}
                      onChange={(saturation) => patchChannel(key, { saturation })}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <footer className="appearance-editor__foot">
        <button
          type="button"
          className="appearance-editor__btn appearance-editor__btn--ghost"
          onClick={revertAndClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="appearance-editor__btn appearance-editor__btn--solid"
          disabled={!dirty}
          onClick={save}
        >
          Save changes
        </button>
      </footer>
    </div>
  )
}

function snapshot(appearance: Parameters<typeof appearanceTheme>[0] & { themeId: string }): Draft {
  const theme = appearanceTheme(appearance)
  return {
    ...theme,
    themeId: appearance.themeId
  }
}

function HueSlider({
  label,
  value,
  onChange
}: {
  label: string
  value: number
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <label className="appearance-editor__slider">
      <span className="appearance-editor__slider-top">
        <span>{label}</span>
        <span className="appearance-editor__slider-val">{value}°</span>
      </span>
      <input
        type="range"
        min={0}
        max={359}
        step={1}
        value={value}
        className="appearance-editor__range"
        style={{ ['--ug-hue' as string]: value / 360 }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function ToneSlider({
  label,
  value,
  onChange
}: {
  label: string
  value: number
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <label className="appearance-editor__slider">
      <span className="appearance-editor__slider-top">
        <span>{label}</span>
        <span className="appearance-editor__slider-val">{value}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={200}
        step={1}
        value={value}
        className="appearance-editor__range appearance-editor__range--tone"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
