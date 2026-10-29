import { useEffect, useMemo, useRef, useState } from 'react'
import { Vector2 } from 'three'
import { Icon } from '@renderer/components/ui/Icon'
import { usePlayback } from '../PlaybackContext'
import { GrooveAudioSampler } from '../nowPlaying/GrooveAudioSampler'
import {
  BUTTERCHURN_FFT_SIZE,
  fillButterchurnAudioLevels,
  getButterchurn,
  isButterchurnSupportedCached
} from '../nowPlaying/vis/butterchurnApi'
import {
  COLOR_THEMES,
  DEFAULT_COLOR,
  rainbowHue,
  stepTheme,
  type ColorSettings,
  type ColorThemeId
} from '../nowPlaying/vis/color'
import { createLoop } from '../nowPlaying/vis/loop'
import {
  createCatalog,
  familyLabel,
  findPreset,
  findVis,
  stepIndex
} from '../nowPlaying/vis/registry'
import { createAudioTextures } from '../nowPlaying/vis/renderer/audioTextures'
import { createRenderer, fitRenderer } from '../nowPlaying/vis/renderer/createRenderer'
import { resolveMilkdropPresetData } from '../nowPlaying/vis/scenes/milkdrop'
import type { VisFamily, Visualization } from '../nowPlaying/vis/types'
import './VisualizerStage.css'

type ButterchurnVisualizer = ReturnType<ReturnType<typeof getButterchurn>['createVisualizer']>

const VIS_KEY = 'umbrix.visualizer.visId'
const PRESET_KEY = 'umbrix.visualizer.presetId'
const THEME_KEY = 'umbrix.visualizer.theme'
const HUE_KEY = 'umbrix.visualizer.hue'

const FAMILIES: VisFamily[] = [
  'ambience',
  'reactive',
  'bars-and-waves',
  'musical-colors',
  'milkdrop'
]

function loadStored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function loadColor(): ColorSettings {
  const themeRaw = loadStored(THEME_KEY, DEFAULT_COLOR.theme)
  const theme = (COLOR_THEMES.some((t) => t.id === themeRaw)
    ? themeRaw
    : DEFAULT_COLOR.theme) as ColorThemeId
  let hue = DEFAULT_COLOR.hue
  try {
    const n = Number(localStorage.getItem(HUE_KEY))
    if (Number.isFinite(n)) hue = Math.min(1, Math.max(0, n))
  } catch {
    /* ignore */
  }
  return { theme, hue }
}

function engineOf(vis: Visualization): 'three' | 'butterchurn' {
  return vis.engine === 'butterchurn' ? 'butterchurn' : 'three'
}

/**
 * Center-pane Now Playing — WMP catalog (now-playing MIT) + Butterchurn Milkdrop + audio tee.
 */
export function VisualizerStage(): React.JSX.Element | null {
  const {
    visualizerOpen,
    setVisualizerOpen,
    currentTrack,
    isPlaying,
    ensureAudioAnalyser,
    getAnalyserFrame,
    getVisualizerAudioGraph
  } = usePlayback()

  const catalog = useMemo(() => createCatalog(), [])
  const [visId, setVisId] = useState(() => loadStored(VIS_KEY, 'battery'))
  const [presetId, setPresetId] = useState(() => loadStored(PRESET_KEY, 'randomization'))
  const [color, setColor] = useState<ColorSettings>(loadColor)
  const colorRef = useRef(color)
  const visIdRef = useRef(visId)
  const presetIdRef = useRef(presetId)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const butterCanvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const samplerRef = useRef(new GrooveAudioSampler())
  const isPlayingRef = useRef(isPlaying)
  const getFrameRef = useRef(getAnalyserFrame)
  const butterRef = useRef<ButterchurnVisualizer | null>(null)
  const butterNodeRef = useRef<AudioNode | null>(null)
  const butterOk = useMemo(() => isButterchurnSupportedCached(), [])
  /** Fresh DOM canvas each Milkdrop session — WEBGL_lose_context poisons a canvas forever. */
  const [butterEpoch, setButterEpoch] = useState(0)
  const butterRetryRef = useRef(0)

  visIdRef.current = visId
  presetIdRef.current = presetId
  colorRef.current = color
  isPlayingRef.current = isPlaying
  getFrameRef.current = getAnalyserFrame

  const activeVis = findVis(catalog, visId)
  const activePreset = findPreset(activeVis, presetId)
  const engine = engineOf(activeVis)

  useEffect(() => {
    if (visualizerOpen && engine === 'butterchurn') {
      butterRetryRef.current = 0
      setButterEpoch((n) => n + 1)
    }
  }, [visualizerOpen, engine])

  const remountButterCanvas = (): void => {
    if (butterRetryRef.current >= 2) return
    butterRetryRef.current += 1
    setButterEpoch((n) => n + 1)
  }

  useEffect(() => {
    try {
      localStorage.setItem(VIS_KEY, visId)
      localStorage.setItem(PRESET_KEY, presetId)
      localStorage.setItem(THEME_KEY, color.theme)
      localStorage.setItem(HUE_KEY, String(color.hue))
    } catch {
      /* ignore */
    }
  }, [visId, presetId, color])

  useEffect(() => {
    if (!visualizerOpen) return
    void ensureAudioAnalyser()
  }, [visualizerOpen, ensureAudioAnalyser, isPlaying])

  // Three.js / now-playing path
  useEffect(() => {
    if (!visualizerOpen || engine !== 'three') return
    const canvas = canvasRef.current
    const viewport = viewportRef.current
    if (!canvas || !viewport) return

    const renderer = createRenderer(canvas)
    const audioTextures = createAudioTextures()
    let active: Visualization | null = null
    let currentId = ''

    const mountVis = (id: string): void => {
      if (currentId === id && active) return
      active?.dispose()
      const next = findVis(catalog, id)
      if (engineOf(next) !== 'three') return
      next.mount({ renderer, audioTextures })
      const size = renderer.getDrawingBufferSize(new Vector2())
      next.resize(Math.max(1, size.x), Math.max(1, size.y))
      active = next
      currentId = id
    }

    const resize = (): void => {
      const { w, h } = fitRenderer(renderer, viewport.clientWidth, viewport.clientHeight)
      active?.resize(w, h)
    }

    mountVis(visIdRef.current)
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(viewport)

    const loop = createLoop((dt) => {
      if (visIdRef.current !== currentId) mountVis(visIdRef.current)
      const vis = active
      if (!vis) return
      const audio = samplerRef.current.sample(getFrameRef.current(), isPlayingRef.current)
      audioTextures.update(audio)
      const preset = findPreset(vis, presetIdRef.current)
      const baseColor = colorRef.current
      const frameColor: ColorSettings =
        baseColor.theme === 'rainbow'
          ? { theme: 'rainbow', hue: rainbowHue(performance.now()) }
          : baseColor
      vis.frame(audio, preset, dt, frameColor)
    })
    loop.start()

    const onLost = (e: Event): void => {
      e.preventDefault()
    }
    canvas.addEventListener('webglcontextlost', onLost)

    return () => {
      loop.stop()
      ro.disconnect()
      canvas.removeEventListener('webglcontextlost', onLost)
      active?.dispose()
      audioTextures.dispose()
      renderer.dispose()
    }
  }, [visualizerOpen, catalog, engine])

  // Butterchurn Milkdrop path (own WebGL2 canvas — cannot share with Three)
  useEffect(() => {
    if (!visualizerOpen || engine !== 'butterchurn' || !butterOk || butterEpoch < 1) return
    const canvas = butterCanvasRef.current
    const viewport = viewportRef.current
    if (!canvas || !viewport) return

    let disposed = false
    let raf = 0
    let visualizer: ButterchurnVisualizer | null = null
    let ro: ResizeObserver | null = null

    const waveScratch = new Uint8Array(BUTTERCHURN_FFT_SIZE)

    const boot = async (): Promise<void> => {
      await ensureAudioAnalyser()
      if (disposed) return
      const graph = getVisualizerAudioGraph()
      if (!graph) return

      // Wait one frame so the fresh canvas is laid out (not display:none / 0×0).
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      if (disposed) return

      const live = butterCanvasRef.current
      if (!live) return

      const rect = viewport.getBoundingClientRect()
      // Butterchurn multiplies width/height by pixelRatio itself — pass CSS pixels only.
      const cssW = Math.max(2, Math.floor(rect.width || viewport.clientWidth || 800))
      const cssH = Math.max(2, Math.floor(rect.height || viewport.clientHeight || 600))
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1)
      live.width = Math.floor(cssW * pixelRatio)
      live.height = Math.floor(cssH * pixelRatio)

      // Probe before Butterchurn — null gl means a poisoned canvas (after loseContext).
      const probe = live.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false
      })
      if (!probe) {
        console.error('[Milkdrop] WebGL2 context is null — remounting canvas')
        remountButterCanvas()
        return
      }

      let next: ButterchurnVisualizer
      try {
        next = getButterchurn().createVisualizer(graph.context, live, {
          width: cssW,
          height: cssH,
          pixelRatio,
          textureRatio: 1
        })
      } catch (err) {
        console.error('[Milkdrop] createVisualizer failed', err)
        remountButterCanvas()
        return
      }
      if (disposed) return

      // Tap the shared MediaElementSource (also feed levels manually each frame below).
      try {
        next.connectAudio(graph.node)
      } catch (err) {
        console.warn('[Milkdrop] connectAudio failed — using analyser feed only', err)
      }
      visualizer = next
      butterRef.current = next
      butterNodeRef.current = graph.node

      const vis = findVis(catalog, visIdRef.current)
      const preset = findPreset(vis, presetIdRef.current)
      const data = resolveMilkdropPresetData(preset)
      if (data) {
        try {
          next.loadPreset(data, 0)
        } catch (err) {
          console.error('[Milkdrop] loadPreset failed', err)
        }
      } else {
        console.warn('[Milkdrop] preset data missing for', preset.id)
      }

      const resize = (): void => {
        if (!visualizer) return
        const el = butterCanvasRef.current
        if (!el) return
        const r = viewport.getBoundingClientRect()
        const rw = Math.max(2, Math.floor(r.width || viewport.clientWidth || 800))
        const rh = Math.max(2, Math.floor(r.height || viewport.clientHeight || 600))
        const ratio = Math.min(2, window.devicePixelRatio || 1)
        el.width = Math.floor(rw * ratio)
        el.height = Math.floor(rh * ratio)
        // Same contract as createVisualizer: CSS pixels; library applies pixelRatio.
        visualizer.setRendererSize(rw, rh, { pixelRatio: ratio })
      }
      resize()
      ro = new ResizeObserver(resize)
      ro.observe(viewport)

      const tick = (): void => {
        if (disposed || !visualizer) return
        const frame = getFrameRef.current()
        if (frame) {
          visualizer.render({
            audioLevels: fillButterchurnAudioLevels(frame.waveform, waveScratch)
          })
        } else {
          visualizer.render()
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    void boot()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro?.disconnect()
      const node = butterNodeRef.current
      if (visualizer && node) {
        try {
          visualizer.disconnectAudio(node)
        } catch {
          /* already gone */
        }
      }
      butterRef.current = null
      butterNodeRef.current = null
      visualizer = null
      // Do NOT call WEBGL_lose_context here — that permanently kills the canvas.
    }
  }, [
    visualizerOpen,
    engine,
    butterOk,
    butterEpoch,
    ensureAudioAnalyser,
    getVisualizerAudioGraph,
    catalog
  ])

  // Swap Milkdrop preset without remounting the GL context
  useEffect(() => {
    if (!visualizerOpen || engine !== 'butterchurn') return
    const viz = butterRef.current
    if (!viz) return
    const data = resolveMilkdropPresetData(activePreset)
    if (!data) return
    try {
      viz.loadPreset(data, 1.2)
    } catch (err) {
      console.error('[Milkdrop] loadPreset failed', err)
    }
  }, [visualizerOpen, engine, activePreset])

  useEffect(() => {
    if (!visualizerOpen) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setVisualizerOpen(false)
        return
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        const dir = event.key === 'ArrowUp' ? -1 : 1
        const idx = catalog.findIndex((v) => v.id === visIdRef.current)
        const next = catalog[stepIndex(catalog.length, Math.max(0, idx), dir)]!
        setVisId(next.id)
        setPresetId(next.presets[0]!.id)
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const vis = findVis(catalog, visIdRef.current)
        const idx = vis.presets.findIndex((p) => p.id === presetIdRef.current)
        const next =
          vis.presets[
            stepIndex(vis.presets.length, Math.max(0, idx), event.key === 'ArrowRight' ? 1 : -1)
          ]!
        setPresetId(next.id)
      }
      if (event.key === '[' || event.key === ']') {
        event.preventDefault()
        setColor((prev) => ({
          ...prev,
          theme: stepTheme(prev.theme, event.key === ']' ? 1 : -1)
        }))
      }
      if (event.key === ',' || event.key === '.') {
        event.preventDefault()
        setColor((prev) => ({
          ...prev,
          hue: Math.min(1, Math.max(0, prev.hue + (event.key === '.' ? 0.04 : -0.04)))
        }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visualizerOpen, setVisualizerOpen, catalog])

  if (!visualizerOpen) return null

  const pick = (nextVisId: string, nextPresetId: string): void => {
    setVisId(nextVisId)
    setPresetId(nextPresetId)
  }

  const showColor = engine === 'three'

  return (
    <div className="visualizer-stage" role="dialog" aria-label="Music visualizer">
      <div className="visualizer-stage__viewport" ref={viewportRef}>
        <canvas
          ref={canvasRef}
          className={`visualizer-stage__canvas${engine === 'three' ? '' : ' is-hidden'}`}
        />
        <canvas
          key={`butter-${butterEpoch}`}
          ref={butterCanvasRef}
          className={`visualizer-stage__canvas visualizer-stage__canvas--butter${
            engine === 'butterchurn' && butterOk ? '' : ' is-hidden'
          }`}
        />
        {engine === 'butterchurn' && !butterOk ? (
          <p className="visualizer-stage__engine-note">Milkdrop needs WebGL2 on this machine.</p>
        ) : null}
        <div className="visualizer-stage__chrome">
          <div className="visualizer-stage__meta">
            <strong>{currentTrack?.title ?? 'Nothing playing'}</strong>
            <span>
              {activeVis.name}
              {' · '}
              {activePreset.name}
              {currentTrack?.artistName ? ` · ${currentTrack.artistName}` : ''}
              {!isPlaying && currentTrack ? ' · paused' : ''}
            </span>
          </div>
        </div>
        <p className="visualizer-stage__hint">
          ↑↓ viz · ←→ preset
          {showColor ? ' · [ ] color · , . hue' : ''} · Esc to leave
        </p>
      </div>

      <aside className="visualizer-stage__rail" aria-label="Visualization catalog">
        <div className="visualizer-stage__rail-head">
          <div>
            <p className="visualizer-stage__rail-kicker">Now Playing</p>
            <h2>Visualizations</h2>
          </div>
          <button
            type="button"
            className="visualizer-stage__close"
            aria-label="Close visualizer"
            onClick={() => setVisualizerOpen(false)}
          >
            <Icon name="close" size={14} />
          </button>
        </div>

        <div className="visualizer-stage__rail-scroll">
          {showColor ? (
            <section className="visualizer-stage__family visualizer-stage__colors">
              <h3>Color</h3>
              <div className="visualizer-stage__swatches" role="listbox" aria-label="Color theme">
                {COLOR_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    role="option"
                    aria-selected={color.theme === theme.id}
                    className={`visualizer-stage__swatch${
                      color.theme === theme.id ? ' is-on' : ''
                    }${theme.id === 'rainbow' ? ' is-rainbow' : ''}`}
                    title={theme.name}
                    style={
                      {
                        '--swatch': theme.swatch,
                        '--swatch-bg': theme.swatchStyle ?? theme.swatch
                      } as React.CSSProperties
                    }
                    onClick={() => setColor((prev) => ({ ...prev, theme: theme.id }))}
                  >
                    <span className="visualizer-stage__swatch-dot" />
                    <span className="visualizer-stage__swatch-label">{theme.name}</span>
                  </button>
                ))}
              </div>
              {color.theme === 'rainbow' ? (
                <p className="visualizer-stage__hue-note">Cycling all hues</p>
              ) : (
                <label className="visualizer-stage__hue">
                  <span>Hue shift</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={color.hue}
                    aria-label="Hue shift"
                    onChange={(event) =>
                      setColor((prev) => ({ ...prev, hue: Number(event.target.value) }))
                    }
                  />
                </label>
              )}
            </section>
          ) : (
            <section className="visualizer-stage__family">
              <h3>Milkdrop</h3>
              <p className="visualizer-stage__hue-note">
                Colors live inside each preset — switch to a Groove viz for themes.
              </p>
            </section>
          )}

          {FAMILIES.map((family) => {
            const items = catalog.filter((v) => v.family === family)
            if (items.length === 0) return null
            if (family === 'milkdrop' && !butterOk) return null
            return (
              <section key={family} className="visualizer-stage__family">
                <h3>{familyLabel(family)}</h3>
                {items.map((vis) => {
                  const open = vis.id === visId
                  return (
                    <div
                      key={vis.id}
                      className={`visualizer-stage__vis${open ? ' is-active' : ''}`}
                    >
                      <button
                        type="button"
                        className="visualizer-stage__vis-btn"
                        aria-expanded={open}
                        onClick={() => pick(vis.id, vis.presets[0]!.id)}
                      >
                        <span>{vis.name}</span>
                        <em>{vis.era}</em>
                      </button>
                      {open ? (
                        <ul className="visualizer-stage__presets">
                          {vis.presets.map((preset) => (
                            <li key={preset.id}>
                              <button
                                type="button"
                                className={
                                  preset.id === presetId
                                    ? 'visualizer-stage__preset is-on'
                                    : 'visualizer-stage__preset'
                                }
                                onClick={() => pick(vis.id, preset.id)}
                                title={preset.kind === 'milkdrop' ? preset.key : preset.name}
                              >
                                {preset.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  )
                })}
              </section>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
