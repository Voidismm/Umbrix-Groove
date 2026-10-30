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
import { isShellResizing, SHELL_RESIZE_END_EVENT } from '@renderer/lib/shellResize'
import './VisualizerStage.css'

type ButterchurnVisualizer = ReturnType<ReturnType<typeof getButterchurn>['createVisualizer']>

const VIS_KEY = 'umbrix.visualizer.visId'
const PRESET_KEY = 'umbrix.visualizer.presetId'
const THEME_KEY = 'umbrix.visualizer.theme'
const HUE_KEY = 'umbrix.visualizer.hue'
const FAV_KEY = 'umbrix.visualizer.favorites'
const FOLDER_KEY = 'umbrix.visualizer.folders'
const RAIL_W_KEY = 'umbrix.visualizer.railWidth'
const RAIL_COLLAPSE_KEY = 'umbrix.visualizer.railCollapsed'
const PREFS_KEY = 'umbrix.visualizer.chromePrefs'
const RAIL_MIN = 260
const RAIL_MAX = 480
const RAIL_DEFAULT = 320
const RAIL_COLLAPSED = 48

type ChromePrefs = {
  /** Title (top-left) + guide hint (bottom-left). Default on. */
  showOverlayText: boolean
  /** Keep player footer visible in fullscreen. Default off. */
  alwaysShowFooter: boolean
  /** Keep viz sidebar visible in fullscreen. Default off. */
  alwaysShowSidebar: boolean
  /** Display prefs panel open. Default collapsed. */
  displayOpen: boolean
}

const DEFAULT_CHROME_PREFS: ChromePrefs = {
  showOverlayText: true,
  alwaysShowFooter: false,
  alwaysShowSidebar: false,
  displayOpen: false
}

function loadChromePrefs(): ChromePrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<ChromePrefs>
    return {
      showOverlayText: raw.showOverlayText !== false,
      alwaysShowFooter: !!raw.alwaysShowFooter,
      alwaysShowSidebar: !!raw.alwaysShowSidebar,
      displayOpen: !!raw.displayOpen
    }
  } catch {
    return { ...DEFAULT_CHROME_PREFS }
  }
}

const DEFAULT_FAMILIES: VisFamily[] = [
  'ambience',
  'reactive',
  'bars-and-waves',
  'musical-colors'
]

type FolderId = 'favorites' | 'milkdrop' | 'defaults'

type FolderOpenState = Record<FolderId, boolean>

/** Default viz: `visId`. Milkdrop presets: `visId::presetId`. */
function presetFavKey(visId: string, presetId: string): string {
  return `${visId}::${presetId}`
}

function parseFavKey(key: string): { visId: string; presetId: string | null } {
  const sep = key.indexOf('::')
  if (sep < 0) return { visId: key, presetId: null }
  return { visId: key.slice(0, sep), presetId: key.slice(sep + 2) }
}

function loadFavorites(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return []
  }
}

function loadFolders(): FolderOpenState {
  const fallback: FolderOpenState = { favorites: true, milkdrop: true, defaults: true }
  try {
    const raw = JSON.parse(localStorage.getItem(FOLDER_KEY) ?? '{}') as Partial<FolderOpenState>
    return {
      favorites: raw.favorites !== false,
      milkdrop: raw.milkdrop !== false,
      defaults: raw.defaults !== false
    }
  } catch {
    return fallback
  }
}

function loadStored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function loadRailWidth(): number {
  try {
    const n = Number(localStorage.getItem(RAIL_W_KEY))
    if (Number.isFinite(n)) return Math.min(RAIL_MAX, Math.max(RAIL_MIN, Math.round(n)))
  } catch {
    /* ignore */
  }
  return RAIL_DEFAULT
}

function loadRailCollapsed(): boolean {
  try {
    return localStorage.getItem(RAIL_COLLAPSE_KEY) === '1'
  } catch {
    return false
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
  const [favorites, setFavorites] = useState<string[]>(loadFavorites)
  const [foldersOpen, setFoldersOpen] = useState<FolderOpenState>(loadFolders)
  const [fullscreen, setFullscreen] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [railWidth, setRailWidth] = useState(loadRailWidth)
  const [railCollapsed, setRailCollapsed] = useState(loadRailCollapsed)
  const [chromePrefs, setChromePrefs] = useState<ChromePrefs>(loadChromePrefs)
  const colorRef = useRef(color)
  const visIdRef = useRef(visId)
  const presetIdRef = useRef(presetId)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const butterCanvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const chromeTimerRef = useRef<number | null>(null)
  const chromeHoldRef = useRef(false)
  const railDragRef = useRef<{ startX: number; startW: number } | null>(null)
  const railWidthRef = useRef(railWidth)
  railWidthRef.current = railWidth
  const samplerRef = useRef(new GrooveAudioSampler())
  const isPlayingRef = useRef(isPlaying)
  const getFrameRef = useRef(getAnalyserFrame)
  const butterRef = useRef<ButterchurnVisualizer | null>(null)
  const butterNodeRef = useRef<AudioNode | null>(null)
  const butterOk = useMemo(() => isButterchurnSupportedCached(), [])
  /** Fresh DOM canvas each Milkdrop session — WEBGL_lose_context poisons a canvas forever. */
  const [butterEpoch, setButterEpoch] = useState(0)
  /** Same poison rule for Three — remount the canvas after loseContext teardown. */
  const [threeEpoch, setThreeEpoch] = useState(0)
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
    if (!visualizerOpen) return
    if (engine === 'butterchurn') {
      butterRetryRef.current = 0
      setButterEpoch((n) => n + 1)
    } else if (engine === 'three') {
      setThreeEpoch((n) => n + 1)
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
      localStorage.setItem(FAV_KEY, JSON.stringify(favorites))
      localStorage.setItem(FOLDER_KEY, JSON.stringify(foldersOpen))
      localStorage.setItem(RAIL_W_KEY, String(railWidth))
      localStorage.setItem(RAIL_COLLAPSE_KEY, railCollapsed ? '1' : '0')
      localStorage.setItem(PREFS_KEY, JSON.stringify(chromePrefs))
    } catch {
      /* ignore */
    }
  }, [visId, presetId, color, favorites, foldersOpen, railWidth, railCollapsed, chromePrefs])

  const railOccupy = railCollapsed ? RAIL_COLLAPSED : railWidth
  const footerPinned = chromePrefs.alwaysShowFooter
  const sidebarPinned = chromePrefs.alwaysShowSidebar
  const sidebarShowing = !fullscreen || chromeVisible || sidebarPinned
  const footerShowing = !fullscreen || chromeVisible || footerPinned
  /** In fullscreen, chrome-hide also tucks the rail so it is not in the way. */
  const railLayout = sidebarShowing ? railOccupy : 0

  const patchChromePrefs = (patch: Partial<ChromePrefs>): void => {
    setChromePrefs((prev) => ({ ...prev, ...patch }))
  }

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--ug-viz-rail', `${railLayout}px`)
    root.dataset.vizRail = railCollapsed ? 'collapsed' : 'open'
    return () => {
      root.style.removeProperty('--ug-viz-rail')
      delete root.dataset.vizRail
    }
  }, [railLayout, railCollapsed])

  useEffect(() => {
    if (!visualizerOpen) return
    void ensureAudioAnalyser()
  }, [visualizerOpen, ensureAudioAnalyser, isPlaying])

  const clearChromeTimer = (): void => {
    if (chromeTimerRef.current != null) {
      window.clearTimeout(chromeTimerRef.current)
      chromeTimerRef.current = null
    }
  }

  const scheduleChromeHide = (): void => {
    clearChromeTimer()
    chromeTimerRef.current = window.setTimeout(() => {
      if (chromeHoldRef.current) return
      setChromeVisible(false)
      chromeTimerRef.current = null
    }, 1800)
  }

  const bumpChrome = (): void => {
    if (!fullscreen) return
    setChromeVisible(true)
    if (!chromeHoldRef.current) scheduleChromeHide()
  }

  useEffect(() => {
    const root = document.documentElement
    if (!visualizerOpen || !fullscreen) {
      delete root.dataset.vizFullscreen
      delete root.dataset.vizChrome
      delete root.dataset.vizFooter
      delete root.dataset.vizSidebar
      clearChromeTimer()
      chromeHoldRef.current = false
      return
    }
    root.dataset.vizFullscreen = 'true'
    root.dataset.vizChrome = chromeVisible ? 'visible' : 'hidden'
    root.dataset.vizFooter = footerShowing ? 'visible' : 'hidden'
    root.dataset.vizSidebar = sidebarShowing ? 'visible' : 'hidden'
  }, [visualizerOpen, fullscreen, chromeVisible, footerShowing, sidebarShowing])

  useEffect(() => {
    if (!visualizerOpen) {
      setFullscreen(false)
      setChromeVisible(true)
      clearChromeTimer()
      delete document.documentElement.dataset.vizFullscreen
      delete document.documentElement.dataset.vizChrome
      delete document.documentElement.dataset.vizFooter
      delete document.documentElement.dataset.vizSidebar
    }
  }, [visualizerOpen])

  useEffect(() => {
    if (!visualizerOpen || !fullscreen) return

    const onMove = (): void => bumpChrome()
    const onHoldEnter = (): void => {
      chromeHoldRef.current = true
      clearChromeTimer()
      setChromeVisible(true)
    }
    const onHoldLeave = (): void => {
      chromeHoldRef.current = false
      scheduleChromeHide()
    }

    window.addEventListener('mousemove', onMove)
    const footer = document.querySelector('.player-footer')
    const rail = stageRef.current?.querySelector('.visualizer-stage__rail')
    footer?.addEventListener('mouseenter', onHoldEnter)
    footer?.addEventListener('mouseleave', onHoldLeave)
    rail?.addEventListener('mouseenter', onHoldEnter)
    rail?.addEventListener('mouseleave', onHoldLeave)
    bumpChrome()

    return () => {
      window.removeEventListener('mousemove', onMove)
      footer?.removeEventListener('mouseenter', onHoldEnter)
      footer?.removeEventListener('mouseleave', onHoldLeave)
      rail?.removeEventListener('mouseenter', onHoldEnter)
      rail?.removeEventListener('mouseleave', onHoldLeave)
      clearChromeTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bump/schedule are stable enough for this mount
  }, [visualizerOpen, fullscreen, footerPinned, sidebarPinned])

  // Three.js / now-playing path
  useEffect(() => {
    if (!visualizerOpen || engine !== 'three' || threeEpoch < 1) return
    const canvas = canvasRef.current
    const viewport = viewportRef.current
    if (!canvas || !viewport) return

    let renderer: ReturnType<typeof createRenderer>
    try {
      renderer = createRenderer(canvas)
    } catch (err) {
      console.error('[Visualizer] Three WebGL init failed', err)
      return
    }
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

    const measure = (): { cssW: number; cssH: number } => {
      const r = viewport.getBoundingClientRect()
      return {
        cssW: Math.max(2, Math.floor(r.width || viewport.clientWidth || 2)),
        cssH: Math.max(2, Math.floor(r.height || viewport.clientHeight || 2))
      }
    }

    const resize = (): void => {
      if (isShellResizing()) return
      const { cssW, cssH } = measure()
      const { w, h } = fitRenderer(renderer, cssW, cssH)
      active?.resize(w, h)
    }

    mountVis(visIdRef.current)
    resize()
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(resize)
    })
    ro.observe(viewport)
    window.addEventListener(SHELL_RESIZE_END_EVENT, resize)

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
      window.removeEventListener(SHELL_RESIZE_END_EVENT, resize)
      canvas.removeEventListener('webglcontextlost', onLost)
      active?.dispose()
      audioTextures.dispose()
      renderer.dispose()
      // Drop the GL context so leaving the viz returns GPU memory to the shell.
      try {
        const gl = renderer.getContext()
        gl?.getExtension('WEBGL_lose_context')?.loseContext()
      } catch {
        /* ignore */
      }
    }
  }, [visualizerOpen, catalog, engine, threeEpoch])

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
    let onShellResizeEnd: (() => void) | null = null
    /** Canvas for this session — keep a handle so teardown can release GL after unmount. */
    const sessionCanvas = canvas

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
      const cssW = Math.max(2, Math.floor(rect.width || viewport.clientWidth || 800))
      const cssH = Math.max(2, Math.floor(rect.height || viewport.clientHeight || 600))
      /*
        Butterchurn bug/quirk: final blit uses gl.viewport(0,0, width, height),
        while textures use width*pixelRatio. With pixelRatio>1 only the
        bottom-left of the canvas is painted (black strip on the right/top).
        Bake DPR into width/height and keep pixelRatio at 1.
      */
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const bufW = Math.max(2, Math.floor(cssW * dpr))
      const bufH = Math.max(2, Math.floor(cssH * dpr))
      live.width = bufW
      live.height = bufH
      live.style.width = '100%'
      live.style.height = '100%'
      live.style.maxWidth = 'none'
      live.style.maxHeight = 'none'

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
          width: bufW,
          height: bufH,
          pixelRatio: 1,
          textureRatio: 1
        })
      } catch (err) {
        console.error('[Milkdrop] createVisualizer failed', err)
        remountButterCanvas()
        return
      }
      if (disposed) {
        // Created after close — release immediately so it cannot pin GPU memory.
        try {
          const gl = live.getContext('webgl2')
          gl?.getExtension('WEBGL_lose_context')?.loseContext()
        } catch {
          /* ignore */
        }
        return
      }

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
        if (disposed || isShellResizing()) return
        if (!visualizer) return
        const el = butterCanvasRef.current
        if (!el) return
        const r = viewport.getBoundingClientRect()
        const rw = Math.max(2, Math.floor(r.width || viewport.clientWidth || 800))
        const rh = Math.max(2, Math.floor(r.height || viewport.clientHeight || 600))
        const ratio = Math.min(2, window.devicePixelRatio || 1)
        const bw = Math.max(2, Math.floor(rw * ratio))
        const bh = Math.max(2, Math.floor(rh * ratio))
        el.width = bw
        el.height = bh
        el.style.width = '100%'
        el.style.height = '100%'
        el.style.maxWidth = 'none'
        el.style.maxHeight = 'none'
        // width/height must match the canvas buffer (see createVisualizer note above).
        visualizer.setRendererSize(bw, bh, { pixelRatio: 1 })
      }
      resize()
      ro = new ResizeObserver(() => {
        if (disposed) return
        requestAnimationFrame(resize)
      })
      ro.observe(viewport)
      onShellResizeEnd = resize
      window.addEventListener(SHELL_RESIZE_END_EVENT, resize)

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
      if (disposed) return
      raf = requestAnimationFrame(tick)
    }

    void boot()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro?.disconnect()
      if (onShellResizeEnd) {
        window.removeEventListener(SHELL_RESIZE_END_EVENT, onShellResizeEnd)
      }
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
      // Safe on close: this canvas is unmounted; next open bumps butterEpoch for a fresh one.
      try {
        const gl = sessionCanvas.getContext('webgl2')
        gl?.getExtension('WEBGL_lose_context')?.loseContext()
      } catch {
        /* ignore */
      }
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
        if (fullscreen) {
          setFullscreen(false)
          setChromeVisible(true)
          return
        }
        setVisualizerOpen(false)
        return
      }
      if (event.key === 'f' || event.key === 'F') {
        const t = event.target
        if (t instanceof HTMLElement) {
          const tag = t.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return
        }
        event.preventDefault()
        setFullscreen((prev) => !prev)
        setChromeVisible(true)
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
  }, [visualizerOpen, setVisualizerOpen, catalog, fullscreen])

  if (!visualizerOpen) return null

  const pick = (nextVisId: string, nextPresetId: string): void => {
    setVisId(nextVisId)
    setPresetId(nextPresetId)
  }

  const toggleFavorite = (key: string): void => {
    setFavorites((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    )
  }

  const toggleFolder = (id: FolderId): void => {
    setFoldersOpen((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const showColor = engine === 'three'
  const milkdropItems = catalog.filter((v) => v.family === 'milkdrop')
  const defaultItems = catalog.filter((v) => DEFAULT_FAMILIES.includes(v.family))
  const milkdropCount = milkdropItems.reduce((sum, vis) => sum + vis.presets.length, 0)

  const beginRailResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (railCollapsed) return
    event.preventDefault()
    railDragRef.current = { startX: event.clientX, startW: railWidthRef.current }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveRailResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = railDragRef.current
    if (!drag) return
    // Dragging the left edge of the rail: move left = wider rail.
    const next = Math.min(
      RAIL_MAX,
      Math.max(RAIL_MIN, Math.round(drag.startW + (drag.startX - event.clientX)))
    )
    setRailWidth(next)
  }

  const endRailResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!railDragRef.current) return
    railDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const renderStar = (key: string, label: string): React.JSX.Element => {
    const starred = favorites.includes(key)
    return (
      <button
        type="button"
        className={`visualizer-stage__star${starred ? ' is-on' : ''}`}
        aria-label={starred ? `Remove ${label} from favorites` : `Favorite ${label}`}
        aria-pressed={starred}
        data-groove-tip={starred ? 'Remove from favorites' : 'Add to favorites'}
        onClick={() => toggleFavorite(key)}
      >
        <Icon name={starred ? 'star-filled' : 'star'} size={20} />
      </button>
    )
  }

  /** Groove / default visuals — star the whole visual. */
  const renderVisList = (items: Visualization[]): React.JSX.Element => (
    <>
      {items.map((vis) => {
        const open = vis.id === visId
        return (
          <div key={vis.id} className={`visualizer-stage__vis${open ? ' is-active' : ''}`}>
            <div className="visualizer-stage__vis-row">
              <button
                type="button"
                className="visualizer-stage__vis-btn"
                aria-expanded={open}
                onClick={() => pick(vis.id, vis.presets[0]!.id)}
              >
                <span>{vis.name}</span>
                <em>{vis.era}</em>
              </button>
              {renderStar(vis.id, vis.name)}
            </div>
            {open ? (
              <ul className="visualizer-stage__presets">
                {vis.presets.map((preset) => (
                  <li key={preset.id}>
                    <button
                      type="button"
                      className={
                        preset.id === presetId && vis.id === visId
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
    </>
  )

  /** Milkdrop — same card look as default visuals; each preset is its own starred row. */
  const renderMilkdropPresets = (items: Visualization[]): React.JSX.Element => (
    <>
      {items.map((vis) => (
        <div key={vis.id} className="visualizer-stage__subfamily">
          <h4>{vis.era}</h4>
          {vis.presets.map((preset) => {
            const key = presetFavKey(vis.id, preset.id)
            const on = vis.id === visId && preset.id === presetId
            return (
              <div
                key={key}
                className={`visualizer-stage__vis${on ? ' is-active' : ''}`}
              >
                <div className="visualizer-stage__vis-row">
                  <button
                    type="button"
                    className="visualizer-stage__vis-btn"
                    onClick={() => pick(vis.id, preset.id)}
                    title={preset.kind === 'milkdrop' ? preset.key : preset.name}
                  >
                    <span>{preset.name}</span>
                    <em>{vis.name}</em>
                  </button>
                  {renderStar(key, preset.name)}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </>
  )

  const renderFavorites = (): React.JSX.Element => (
    <>
      {favorites.map((key) => {
        const { visId: favVisId, presetId: favPresetId } = parseFavKey(key)
        const vis = catalog.find((v) => v.id === favVisId)
        if (!vis) return null

        if (favPresetId) {
          const preset = vis.presets.find((p) => p.id === favPresetId)
          if (!preset) return null
          const on = vis.id === visId && preset.id === presetId
          return (
            <div key={key} className={`visualizer-stage__vis${on ? ' is-active' : ''}`}>
              <div className="visualizer-stage__vis-row">
                <button
                  type="button"
                  className="visualizer-stage__vis-btn"
                  onClick={() => pick(vis.id, preset.id)}
                  title={preset.kind === 'milkdrop' ? preset.key : preset.name}
                >
                  <span>{preset.name}</span>
                  <em>{vis.name}</em>
                </button>
                {renderStar(key, preset.name)}
              </div>
            </div>
          )
        }

        const open = vis.id === visId
        return (
          <div key={key} className={`visualizer-stage__vis${open ? ' is-active' : ''}`}>
            <div className="visualizer-stage__vis-row">
              <button
                type="button"
                className="visualizer-stage__vis-btn"
                aria-expanded={open}
                onClick={() => pick(vis.id, vis.presets[0]!.id)}
              >
                <span>{vis.name}</span>
                <em>{vis.era}</em>
              </button>
              {renderStar(vis.id, vis.name)}
            </div>
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
    </>
  )

  return (
    <div
      ref={stageRef}
      className={`visualizer-stage${fullscreen ? ' is-fullscreen' : ''}${
        railCollapsed ? ' is-rail-collapsed' : ''
      }${fullscreen && !sidebarShowing ? ' is-chrome-hidden' : ''}`}
      style={{ gridTemplateColumns: `minmax(0, 1fr) ${railLayout}px` }}
      role="dialog"
      aria-label="Music visualizer"
    >
      <div
        className="visualizer-stage__viewport"
        ref={viewportRef}
        onDoubleClick={(event) => {
          if ((event.target as HTMLElement).closest('button')) return
          setFullscreen((prev) => !prev)
          setChromeVisible(true)
        }}
      >
        <canvas
          key={`three-${threeEpoch}`}
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
        {chromePrefs.showOverlayText ? (
          <>
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
              {showColor ? ' · [ ] color · , . hue' : ''} · double-click or F · Esc to leave
            </p>
          </>
        ) : null}
        <button
          type="button"
          className={`visualizer-stage__fs-btn${fullscreen ? ' is-on is-fullscreen-pos' : ''}${
            fullscreen && !chromeVisible && !footerPinned ? ' is-chrome-hidden' : ''
          }`}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          aria-pressed={fullscreen}
          data-groove-tip={fullscreen ? 'Exit fullscreen' : 'Fullscreen visualizer'}
          onClick={() => {
            setFullscreen((prev) => !prev)
            setChromeVisible(true)
          }}
          onDoubleClick={(event) => event.stopPropagation()}
          onMouseEnter={() => {
            if (!fullscreen) return
            chromeHoldRef.current = true
            clearChromeTimer()
            setChromeVisible(true)
          }}
          onMouseLeave={() => {
            if (!fullscreen) return
            chromeHoldRef.current = false
            scheduleChromeHide()
          }}
        >
          <Icon name="fullscreen" size={16} />
        </button>
      </div>

      <aside className="visualizer-stage__rail" aria-label="Visualization catalog">
        {!railCollapsed ? (
          <div
            className="visualizer-stage__rail-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize visualizations sidebar"
            aria-valuenow={railWidth}
            aria-valuemin={RAIL_MIN}
            aria-valuemax={RAIL_MAX}
            onPointerDown={beginRailResize}
            onPointerMove={moveRailResize}
            onPointerUp={endRailResize}
            onPointerCancel={endRailResize}
          />
        ) : null}

        <div className="visualizer-stage__rail-head">
          {railCollapsed ? (
            <button
              type="button"
              className="visualizer-stage__rail-expand"
              aria-label="Expand visualizations sidebar"
              data-groove-tip="Expand sidebar"
              onClick={() => setRailCollapsed(false)}
            >
              <Icon name="panel-right" size={18} />
            </button>
          ) : (
            <>
              <div>
                <p className="visualizer-stage__rail-kicker">Now Playing</p>
                <h2>Visualizations</h2>
              </div>
              <div className="visualizer-stage__rail-actions">
                <button
                  type="button"
                  className="visualizer-stage__rail-tool"
                  aria-label="Collapse visualizations sidebar"
                  data-groove-tip="Collapse sidebar"
                  onClick={() => setRailCollapsed(true)}
                >
                  <Icon name="panel-right" size={16} />
                </button>
                <button
                  type="button"
                  className="visualizer-stage__rail-tool"
                  aria-label="Close visualizer"
                  data-groove-tip="Close visualizer"
                  onClick={() => setVisualizerOpen(false)}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            </>
          )}
        </div>

        <div className="visualizer-stage__rail-scroll" hidden={railCollapsed}>
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
                    className="ug-slider visualizer-stage__hue-slider"
                    min={0}
                    max={1}
                    step={0.01}
                    value={color.hue}
                    aria-label="Hue shift"
                    style={
                      {
                        ['--ug-range' as string]: `${Math.min(100, Math.max(0, color.hue * 100))}%`,
                        ['--ug-hue' as string]: String(color.hue)
                      } as React.CSSProperties
                    }
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

          <VisFolder
            id="favorites"
            label="Favorites"
            count={favorites.length}
            open={foldersOpen.favorites}
            onToggle={() => toggleFolder('favorites')}
            empty={favorites.length === 0}
            emptyText="Star a visual or Milkdrop preset to pin it here."
          >
            {renderFavorites()}
          </VisFolder>

          <VisFolder
            id="defaults"
            label="Default visualizations"
            count={defaultItems.length}
            open={foldersOpen.defaults}
            onToggle={() => toggleFolder('defaults')}
            empty={defaultItems.length === 0}
          >
            {DEFAULT_FAMILIES.map((family) => {
              const items = defaultItems.filter((v) => v.family === family)
              if (items.length === 0) return null
              return (
                <div key={family} className="visualizer-stage__subfamily">
                  <h4>{familyLabel(family).replace(/ family$/i, '')}</h4>
                  {renderVisList(items)}
                </div>
              )
            })}
          </VisFolder>

          {butterOk ? (
            <VisFolder
              id="milkdrop"
              label="Milkdrop"
              count={milkdropCount}
              open={foldersOpen.milkdrop}
              onToggle={() => toggleFolder('milkdrop')}
              empty={milkdropCount === 0}
            >
              {renderMilkdropPresets(milkdropItems)}
            </VisFolder>
          ) : null}
        </div>

        {!railCollapsed ? (
          <div className="visualizer-stage__rail-foot">
            <button
              type="button"
              className="visualizer-stage__rail-foot-head"
              aria-expanded={chromePrefs.displayOpen}
              onClick={() => patchChromePrefs({ displayOpen: !chromePrefs.displayOpen })}
            >
              <span className="visualizer-stage__rail-foot-label">Display</span>
              <span
                className={`visualizer-stage__folder-chevron${
                  chromePrefs.displayOpen ? ' is-open' : ''
                }`}
                aria-hidden
              >
                <Icon name="dropdown" size={28} />
              </span>
            </button>
            {chromePrefs.displayOpen ? (
              <div className="visualizer-stage__rail-foot-body">
                <VizPrefToggle
                  label="Show title & guide text"
                  checked={chromePrefs.showOverlayText}
                  onChange={(checked) => patchChromePrefs({ showOverlayText: checked })}
                />
                <VizPrefToggle
                  label="Always keep playback footer menu up in fullscreen"
                  checked={chromePrefs.alwaysShowFooter}
                  onChange={(checked) => patchChromePrefs({ alwaysShowFooter: checked })}
                />
                <VizPrefToggle
                  label="Always show sidebar in fullscreen"
                  checked={chromePrefs.alwaysShowSidebar}
                  onChange={(checked) => patchChromePrefs({ alwaysShowSidebar: checked })}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  )
}

function VizPrefToggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <div className="visualizer-stage__pref">
      <span className="visualizer-stage__pref-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`visualizer-stage__switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="visualizer-stage__switch-thumb" />
      </button>
    </div>
  )
}

function VisFolder({
  id,
  label,
  count,
  open,
  onToggle,
  empty,
  emptyText,
  children
}: {
  id: FolderId
  label: string
  count: number
  open: boolean
  onToggle: () => void
  empty?: boolean
  emptyText?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="visualizer-stage__folder" data-folder={id}>
      <button
        type="button"
        className="visualizer-stage__folder-head"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="visualizer-stage__folder-lead">
          <Icon name="folder" size={16} />
          <span className="visualizer-stage__folder-label">{label}</span>
          <span className="visualizer-stage__folder-count" aria-label={`${count} items`}>
            {count}
          </span>
        </span>
        <span
          className={`visualizer-stage__folder-chevron${open ? ' is-open' : ''}`}
          aria-hidden
        >
          <Icon name="dropdown" size={28} />
        </span>
      </button>
      {open ? (
        <div className="visualizer-stage__folder-body">
          {empty ? (
            <p className="visualizer-stage__folder-empty">{emptyText ?? 'Nothing here yet.'}</p>
          ) : (
            children
          )}
        </div>
      ) : null}
    </section>
  )
}
