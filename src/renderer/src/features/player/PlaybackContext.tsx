import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { uiVolumeToGain } from '@shared/audio/volumeCurve'
import type { RepeatMode, TrackRow } from '@shared/types'
import { useSettings } from '@renderer/features/settings'
import { artworkUrl, mediaUrl } from '@renderer/lib/format'
import { clearSession, readSession, SESSION_KEYS, writeSession } from '@renderer/lib/session'

export type AnalyserFrame = {
  frequency: Uint8Array<ArrayBuffer>
  waveform: Uint8Array<ArrayBuffer>
  /** Float time-domain samples for now-playing / WebGL viz. */
  timeDomain: Float32Array<ArrayBuffer>
  sampleRate: number
}

type PlaybackContextValue = {
  currentTrack: TrackRow | null
  /** Track shown in the right sidebar — click to inspect without playing. */
  focusedTrack: TrackRow | null
  focusTrack: (track: TrackRow | null) => void
  queue: TrackRow[]
  queueIndex: number
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  error: string | null
  queueOpen: boolean
  setQueueOpen: (open: boolean) => void
  playTrack: (
    track: TrackRow,
    context?: TrackRow[],
    options?: { forceShuffle?: boolean }
  ) => void
  togglePlay: () => void
  pause: () => void
  next: () => void
  previous: () => void
  seek: (seconds: number) => void
  setVolume: (value: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  playNext: (track: TrackRow) => void
  addToQueue: (track: TrackRow) => void
  addTracksToQueue: (tracks: TrackRow[]) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
  jumpToQueueIndex: (index: number) => void
  visualizerOpen: boolean
  setVisualizerOpen: (open: boolean) => void
  /** Wire HTMLAudioElement → Analyser → speakers (lazy; destination must stay linked). */
  ensureAudioAnalyser: () => Promise<boolean>
  getAnalyserFrame: () => AnalyserFrame | null
  /**
   * Same MediaElementSource tee Butterchurn / extra engines can connectAudio() to.
   * Never create a second MediaElementSource — use this node.
   */
  getVisualizerAudioGraph: () => { context: AudioContext; node: AudioNode } | null
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null)

const STORAGE_KEY = 'umbrix.playback.prefs'

type Prefs = {
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
}

type PlaybackSession = {
  queueIds: string[]
  queueIndex: number
  currentTime: number
  queueOpen: boolean
}

function loadPlaybackSession(): PlaybackSession | null {
  const raw = readSession<Partial<PlaybackSession>>(SESSION_KEYS.playback)
  if (!raw || !Array.isArray(raw.queueIds) || raw.queueIds.length === 0) return null
  const queueIds = raw.queueIds.filter((id): id is string => typeof id === 'string' && !!id)
  if (queueIds.length === 0) return null
  return {
    queueIds,
    queueIndex:
      typeof raw.queueIndex === 'number' && raw.queueIndex >= 0
        ? Math.floor(raw.queueIndex)
        : 0,
    currentTime:
      typeof raw.currentTime === 'number' && raw.currentTime >= 0 ? raw.currentTime : 0,
    queueOpen: !!raw.queueOpen
  }
}

function savePlaybackSession(session: PlaybackSession): void {
  writeSession(SESSION_KEYS.playback, session)
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { volume: 0.8, muted: false, shuffle: false, repeat: 'off' }
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      volume: typeof parsed.volume === 'number' ? Math.min(1, Math.max(0, parsed.volume)) : 0.8,
      muted: !!parsed.muted,
      shuffle: !!parsed.shuffle,
      repeat: parsed.repeat === 'all' || parsed.repeat === 'one' ? parsed.repeat : 'off'
    }
  } catch {
    return { volume: 0.8, muted: false, shuffle: false, repeat: 'off' }
  }
}

function shuffleList<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function buildQueue(track: TrackRow, context: TrackRow[] | undefined, shuffle: boolean): TrackRow[] {
  const list = context && context.length > 0 ? context : [track]
  const startIndex = Math.max(
    0,
    list.findIndex((item) => item.id === track.id)
  )
  const ordered = [...list.slice(startIndex), ...list.slice(0, startIndex)]
  if (!shuffle) return ordered

  const [first, ...rest] = ordered
  return [first, ...shuffleList(rest)]
}

export function PlaybackProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { settings } = useSettings()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const freqBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const waveBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const timeBufRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const prefs = useRef(loadPrefs())
  const rememberPositionRef = useRef(settings.playback.rememberPosition)
  rememberPositionRef.current = settings.playback.rememberPosition

  const [queue, setQueue] = useState<TrackRow[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(prefs.current.volume)
  const [muted, setMuted] = useState(prefs.current.muted)
  const [shuffle, setShuffle] = useState(prefs.current.shuffle)
  const [repeat, setRepeat] = useState<RepeatMode>(prefs.current.repeat)
  const [error, setError] = useState<string | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [visualizerOpen, setVisualizerOpen] = useState(false)
  const [focusedTrack, setFocusedTrack] = useState<TrackRow | null>(null)
  const lastAudibleVolume = useRef(
    prefs.current.volume > 0.001 ? prefs.current.volume : 0.8
  )
  const currentTrackIdRef = useRef<string | null>(null)
  const playCreditedRef = useRef(false)
  const queueRef = useRef(queue)
  const queueIndexRef = useRef(queueIndex)
  const currentTimeRef = useRef(0)
  const queueOpenRef = useRef(queueOpen)
  /** Last ordered context used to build the queue — restores order when shuffle turns off. */
  const sourceOrderRef = useRef<TrackRow[]>([])
  /** True only after the first restore attempt finishes (success or empty). */
  const restoreDoneRef = useRef(false)

  const currentTrack = queue[queueIndex] ?? null

  const focusTrack = useCallback((track: TrackRow | null) => {
    setFocusedTrack(track)
  }, [])

  useEffect(() => {
    queueRef.current = queue
    queueIndexRef.current = queueIndex
  }, [queue, queueIndex])

  useEffect(() => {
    currentTimeRef.current = currentTime
  }, [currentTime])

  useEffect(() => {
    queueOpenRef.current = queueOpen
  }, [queueOpen])

  useEffect(() => {
    currentTrackIdRef.current = currentTrack?.id ?? null
    playCreditedRef.current = false
  }, [currentTrack?.id])

  /** Keep the inspect target in sync when playback moves to another track. */
  useEffect(() => {
    setFocusedTrack(currentTrack)
  }, [currentTrack?.id])

  const persistPrefs = useCallback((next: Partial<Prefs>) => {
    prefs.current = { ...prefs.current, ...next }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs.current))
  }, [])

  const creditPlay = useCallback((trackId: string | null | undefined): void => {
    if (!trackId || playCreditedRef.current) return
    if (typeof window === 'undefined' || !window.api?.library?.recordPlay) return
    playCreditedRef.current = true
    void window.api.library.recordPlay(trackId).catch(() => {
      playCreditedRef.current = false
    })
  }, [])

  const maybeCreditOutgoing = useCallback((): void => {
    const audio = audioRef.current
    const outgoingId = currentTrackIdRef.current
    if (!outgoingId || playCreditedRef.current) return
    const listened = audio?.currentTime ?? 0
    if (listened >= 30) creditPlay(outgoingId)
  }, [creditPlay])

  useEffect(() => {
    if (volume > 0.001) lastAudibleVolume.current = volume
  }, [volume])

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    /**
     * Required for Web Audio on custom protocols (Electron Chromium CORS rules).
     * Without this, createMediaElementSource outputs silence / mutes playback.
     * Protocol already sends Access-Control-Allow-Origin: *.
     */
    audio.crossOrigin = 'anonymous'
    audio.volume = 1
    audioRef.current = audio

    const onTime = (): void => setCurrentTime(audio.currentTime)
    const onMeta = (): void => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onPlay = (): void => {
      setIsPlaying(true)
      void audioCtxRef.current?.resume()
    }
    const onPause = (): void => setIsPlaying(false)
    const onError = (): void => {
      setError('Could not play this file. It may be missing or an unsupported format.')
      setIsPlaying(false)
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('error', onError)

    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctx) {
        const ctx = new Ctx()
        const source = ctx.createMediaElementSource(audio)
        const analyser = ctx.createAnalyser()
        // Match now-playing / MDN-ish defaults — wide range + moderate smooth = bounce, not peg.
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.56
        analyser.minDecibels = -90
        analyser.maxDecibels = -18
        const master = ctx.createGain()
        master.gain.value = prefs.current.muted
          ? 0
          : uiVolumeToGain(prefs.current.volume)
        // Speakers + viz tap (analyser is not in the speaker path).
        source.connect(master)
        master.connect(ctx.destination)
        source.connect(analyser)
        audioCtxRef.current = ctx
        mediaSourceRef.current = source
        analyserRef.current = analyser
        masterGainRef.current = master
        freqBufRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
        waveBufRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize))
        timeBufRef.current = new Float32Array(new ArrayBuffer(analyser.fftSize * 4))
      } else {
        audio.volume = prefs.current.muted ? 0 : uiVolumeToGain(prefs.current.volume)
      }
    } catch {
      audio.volume = prefs.current.muted ? 0 : uiVolumeToGain(prefs.current.volume)
    }

    return () => {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('error', onError)
      try {
        mediaSourceRef.current?.disconnect()
      } catch {
        /* already disconnected */
      }
      try {
        masterGainRef.current?.disconnect()
      } catch {
        /* already disconnected */
      }
      try {
        analyserRef.current?.disconnect()
      } catch {
        /* already disconnected */
      }
      void audioCtxRef.current?.close()
      mediaSourceRef.current = null
      masterGainRef.current = null
      analyserRef.current = null
      audioCtxRef.current = null
      freqBufRef.current = null
      waveBufRef.current = null
      timeBufRef.current = null
      audioRef.current = null
    }
  }, [])

  /** Resume AudioContext after a user gesture so FFT + speakers flow. */
  const ensureAudioAnalyser = useCallback(async (): Promise<boolean> => {
    const ctx = audioCtxRef.current
    if (!ctx || !analyserRef.current) return false
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        return false
      }
    }
    return true
  }, [])

  const getAnalyserFrame = useCallback((): AnalyserFrame | null => {
    const analyser = analyserRef.current
    const freq = freqBufRef.current
    const wave = waveBufRef.current
    const timeDomain = timeBufRef.current
    const ctx = audioCtxRef.current
    if (!analyser || !freq || !wave || !timeDomain || !ctx) return null
    analyser.getByteFrequencyData(freq)
    analyser.getByteTimeDomainData(wave)
    analyser.getFloatTimeDomainData(timeDomain)
    return { frequency: freq, waveform: wave, timeDomain, sampleRate: ctx.sampleRate }
  }, [])

  const getVisualizerAudioGraph = useCallback((): {
    context: AudioContext
    node: AudioNode
  } | null => {
    const context = audioCtxRef.current
    const node = mediaSourceRef.current
    if (!context || !node) return null
    return { context, node }
  }, [])

  /**
   * Smooth seek UI while playing (Spotify-style).
   * `timeupdate` alone is too sparse for local files — rAF keeps the bar in sync.
   * Throttle state writes (~20fps) so the whole player tree is not redrawn 60×/sec.
   */
  useEffect(() => {
    if (!isPlaying) return
    let frame = 0
    let lastPosted = -1
    const tick = (): void => {
      const audio = audioRef.current
      if (audio) {
        const t = audio.currentTime
        if (Math.abs(t - lastPosted) >= 0.05) {
          lastPosted = t
          setCurrentTime(t)
        }
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [isPlaying])

  const persistPlaybackSession = useCallback((): void => {
    if (!rememberPositionRef.current) {
      clearSession(SESSION_KEYS.playback)
      return
    }
    const q = queueRef.current
    if (q.length === 0) {
      clearSession(SESSION_KEYS.playback)
      return
    }
    const audioTime = audioRef.current?.currentTime
    const refTime = currentTimeRef.current
    // Right after load(), the element reports 0 before seek applies — do not wipe the saved spot.
    let time = refTime
    if (typeof audioTime === 'number' && Number.isFinite(audioTime)) {
      if (audioTime > 0.25 || refTime <= 0.25) time = audioTime
    }
    savePlaybackSession({
      queueIds: q.map((track) => track.id),
      queueIndex: queueIndexRef.current,
      currentTime: Math.max(0, time),
      queueOpen: queueOpenRef.current
    })
  }, [])

  const seekWhenReady = useCallback((audio: HTMLAudioElement, startAt: number): void => {
    if (startAt <= 0) return

    const apply = (): boolean => {
      try {
        audio.currentTime = startAt
      } catch {
        return false
      }
      const landed = audio.currentTime
      // Some codecs ignore seek until more data is buffered.
      if (landed < startAt - 1 && audio.readyState < 2) return false
      setCurrentTime(landed > 0.05 ? landed : startAt)
      currentTimeRef.current = landed > 0.05 ? landed : startAt
      return true
    }

    if (apply()) return

    const onReady = (): void => {
      if (apply()) {
        audio.removeEventListener('loadedmetadata', onReady)
        audio.removeEventListener('canplay', onReady)
      }
    }
    audio.addEventListener('loadedmetadata', onReady)
    audio.addEventListener('canplay', onReady)
  }, [])

  const loadAndPlay = useCallback(
    async (track: TrackRow, autoplay: boolean, startAtSeconds?: number) => {
      const audio = audioRef.current
      if (!audio) return
      if (currentTrackIdRef.current && currentTrackIdRef.current !== track.id) {
        maybeCreditOutgoing()
      }
      setError(null)
      const startAt =
        typeof startAtSeconds === 'number' && startAtSeconds > 0 ? startAtSeconds : 0
      setCurrentTime(startAt)
      currentTimeRef.current = startAt
      setDuration(track.durationMs != null ? track.durationMs / 1000 : 0)
      audio.src = mediaUrl(track.id)
      audio.load()
      seekWhenReady(audio, startAt)

      if (!autoplay) {
        setIsPlaying(false)
        return
      }
      try {
        await audio.play()
        if (startAt > 0 && audio.currentTime < 0.5) {
          seekWhenReady(audio, startAt)
        }
        void ensureAudioAnalyser()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Playback failed')
        setIsPlaying(false)
      }
    },
    [maybeCreditOutgoing, seekWhenReady, ensureAudioAnalyser]
  )

  /** Restore queue + seek position once; land paused (autoplay is flaky in Electron). */
  useEffect(() => {
    if (restoreDoneRef.current) return
    let cancelled = false

    if (!settings.playback.rememberPosition) {
      clearSession(SESSION_KEYS.playback)
      restoreDoneRef.current = true
      return
    }

    void (async () => {
      try {
        const session = loadPlaybackSession()
        if (!session || !window.api?.library?.listTracksByIds) return

        const tracks = await window.api.library.listTracksByIds(session.queueIds)
        if (cancelled) return
        if (tracks.length === 0) {
          clearSession(SESSION_KEYS.playback)
          return
        }

        const byId = new Map(tracks.map((track) => [track.id, track]))
        const ordered = session.queueIds
          .map((id) => byId.get(id))
          .filter((track): track is TrackRow => Boolean(track))
        if (ordered.length === 0) {
          clearSession(SESSION_KEYS.playback)
          return
        }

        const wantedId = session.queueIds[Math.min(session.queueIndex, session.queueIds.length - 1)]
        let index = ordered.findIndex((track) => track.id === wantedId)
        if (index < 0) index = 0

        setQueue(ordered)
        setQueueIndex(index)
        sourceOrderRef.current = ordered
        setQueueOpen(session.queueOpen)
        await loadAndPlay(ordered[index], false, session.currentTime)
        // Give seek a beat to land before we rewrite session storage.
        if (!cancelled && session.currentTime > 0) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 150)
          })
        }
      } catch {
        // Leave a clean slate if restore fails
      } finally {
        if (!cancelled) {
          restoreDoneRef.current = true
          persistPlaybackSession()
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loadAndPlay, persistPlaybackSession, settings.playback.rememberPosition])

  useEffect(() => {
    if (!settings.playback.rememberPosition) {
      clearSession(SESSION_KEYS.playback)
    }
  }, [settings.playback.rememberPosition])

  useEffect(() => {
    if (!restoreDoneRef.current) return
    persistPlaybackSession()
  }, [queue, queueIndex, queueOpen, persistPlaybackSession])

  useEffect(() => {
    if (!restoreDoneRef.current) return
    if (!isPlaying) {
      persistPlaybackSession()
      return
    }
    const timer = window.setInterval(() => persistPlaybackSession(), 2000)
    return () => window.clearInterval(timer)
  }, [isPlaying, persistPlaybackSession])

  useEffect(() => {
    const onHide = (): void => {
      if (restoreDoneRef.current) persistPlaybackSession()
    }
    window.addEventListener('pagehide', onHide)
    window.addEventListener('beforeunload', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('beforeunload', onHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [persistPlaybackSession])

  const playTrack = useCallback(
    (track: TrackRow, context?: TrackRow[], options?: { forceShuffle?: boolean }) => {
      const useShuffle = options?.forceShuffle ? true : shuffle
      if (options?.forceShuffle && !shuffle) {
        setShuffle(true)
        persistPrefs({ shuffle: true })
      }
      const source = context && context.length > 0 ? [...context] : [track]
      sourceOrderRef.current = source
      const nextQueue = buildQueue(track, source, useShuffle)
      setQueue(nextQueue)
      setQueueIndex(0)
      void loadAndPlay(nextQueue[0], true)
    },
    [loadAndPlay, persistPrefs, shuffle]
  )

  const jumpToQueueIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= queue.length) return
      setQueueIndex(index)
      void loadAndPlay(queue[index], true)
    },
    [loadAndPlay, queue]
  )

  const next = useCallback(() => {
    if (queue.length === 0) return
    if (repeat === 'one') {
      const audio = audioRef.current
      if (audio) {
        audio.currentTime = 0
        void audio.play()
      }
      return
    }
    const atEnd = queueIndex >= queue.length - 1
    if (atEnd) {
      if (repeat === 'all') {
        setQueueIndex(0)
        void loadAndPlay(queue[0], true)
      } else {
        audioRef.current?.pause()
        setIsPlaying(false)
      }
      return
    }
    const nextIndex = queueIndex + 1
    setQueueIndex(nextIndex)
    void loadAndPlay(queue[nextIndex], true)
  }, [loadAndPlay, queue, queueIndex, repeat])

  const previous = useCallback(() => {
    const audio = audioRef.current
    if (!audio || queue.length === 0) return
    if (audio.currentTime > 3 || queueIndex === 0) {
      audio.currentTime = 0
      return
    }
    const prevIndex = queueIndex - 1
    setQueueIndex(prevIndex)
    void loadAndPlay(queue[prevIndex], true)
  }, [loadAndPlay, queue, queueIndex])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnded = (): void => {
      const id = queueRef.current[queueIndexRef.current]?.id
      creditPlay(id)
      // Allow another count if the same track loops (repeat one).
      playCreditedRef.current = false
      next()
    }
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [creditPlay, next])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    if (audio.paused) {
      // Restored UI position can outlive a failed element seek — re-apply before play.
      const wanted = currentTimeRef.current
      if (wanted > 1 && audio.currentTime < 0.5) {
        try {
          audio.currentTime = wanted
        } catch {
          // still loading
        }
      }
      void ensureAudioAnalyser().then(() =>
        audio.play().catch((err) => {
          setError(err instanceof Error ? err.message : 'Playback failed')
        })
      )
    } else {
      audio.pause()
    }
  }, [currentTrack, ensureAudioAnalyser])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(seconds)) return
    const limit =
      Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number.POSITIVE_INFINITY
    const next = Math.max(0, Math.min(seconds, limit))
    try {
      audio.currentTime = next
    } catch {
      // Ignore InvalidStateError while the element is still loading.
    }
    setCurrentTime(audio.currentTime || next)
  }, [])

  /** `uiLevel` is the slider position 0..1; curve maps it to quieter-end-friendly gain. */
  const applyOutputGain = useCallback((uiLevel: number): void => {
    const output = uiLevel <= 0 ? 0 : uiVolumeToGain(uiLevel)
    const gain = masterGainRef.current
    if (gain) {
      gain.gain.value = output
      return
    }
    const audio = audioRef.current
    if (audio) audio.volume = output
  }, [])

  const setVolume = useCallback(
    (value: number) => {
      const nextVol = Math.min(1, Math.max(0, value))
      setVolumeState(nextVol)
      // Raising the slider / keys while muted should audibly unmute.
      if (nextVol > 0.001 && muted) {
        setMuted(false)
        applyOutputGain(nextVol)
        persistPrefs({ volume: nextVol, muted: false })
        return
      }
      applyOutputGain(muted ? 0 : nextVol)
      persistPrefs({ volume: nextVol })
    },
    [muted, persistPrefs, applyOutputGain]
  )

  const toggleMute = useCallback(() => {
    const silent = muted || volume <= 0.001

    if (silent) {
      const restore = volume > 0.001 ? volume : lastAudibleVolume.current
      setVolumeState(restore)
      setMuted(false)
      applyOutputGain(restore)
      persistPrefs({ volume: restore, muted: false })
      return
    }

    setMuted(true)
    applyOutputGain(0)
    persistPrefs({ muted: true })
  }, [muted, persistPrefs, volume, applyOutputGain])

  const toggleShuffle = useCallback(() => {
    const nextShuffle = !shuffle
    setShuffle(nextShuffle)
    persistPrefs({ shuffle: nextShuffle })

    const q = queueRef.current
    const idx = queueIndexRef.current
    const current = q[idx]
    if (!current || q.length <= 1) return

    if (nextShuffle) {
      // Keep the song that is playing; randomize everything else after it.
      const rest = q.filter((_, i) => i !== idx)
      setQueue([current, ...shuffleList(rest)])
      setQueueIndex(0)
      return
    }

    // Shuffle off — put the original context order back under the current track.
    const source = sourceOrderRef.current
    if (source.length === 0) return
    const pos = source.findIndex((item) => item.id === current.id)
    if (pos < 0) return
    setQueue([...source])
    setQueueIndex(pos)
  }, [persistPrefs, shuffle])

  const cycleRepeat = useCallback(() => {
    setRepeat((prev) => {
      const nextMode: RepeatMode = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'
      persistPrefs({ repeat: nextMode })
      return nextMode
    })
  }, [persistPrefs])

  const playNext = useCallback(
    (track: TrackRow) => {
      setQueue((prev) => {
        if (prev.length === 0) {
          void loadAndPlay(track, true)
          setQueueIndex(0)
          return [track]
        }
        const insertAt = queueIndex + 1
        const nextQueue = [...prev.slice(0, insertAt), track, ...prev.slice(insertAt)]
        return nextQueue
      })
    },
    [loadAndPlay, queueIndex]
  )

  const addToQueue = useCallback(
    (track: TrackRow) => {
      setQueue((prev) => {
        if (prev.length === 0) {
          void loadAndPlay(track, false)
          setQueueIndex(0)
          return [track]
        }
        return [...prev, track]
      })
    },
    [loadAndPlay]
  )

  const addTracksToQueue = useCallback(
    (tracks: TrackRow[]) => {
      if (tracks.length === 0) return
      setQueue((prev) => {
        if (prev.length === 0) {
          void loadAndPlay(tracks[0], false)
          setQueueIndex(0)
          return [...tracks]
        }
        return [...prev, ...tracks]
      })
    },
    [loadAndPlay]
  )

  const removeFromQueue = useCallback(
    (index: number) => {
      setQueue((prev) => {
        if (index < 0 || index >= prev.length) return prev
        const nextQueue = prev.filter((_, i) => i !== index)
        if (nextQueue.length === 0) {
          audioRef.current?.pause()
          audioRef.current?.removeAttribute('src')
          setQueueIndex(0)
          setIsPlaying(false)
          setCurrentTime(0)
          setDuration(0)
          return []
        }
        if (index < queueIndex) {
          setQueueIndex((i) => Math.max(0, i - 1))
        } else if (index === queueIndex) {
          const newIndex = Math.min(index, nextQueue.length - 1)
          setQueueIndex(newIndex)
          void loadAndPlay(nextQueue[newIndex], isPlaying)
        }
        return nextQueue
      })
    },
    [isPlaying, loadAndPlay, queueIndex]
  )

  const clearQueue = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current?.removeAttribute('src')
    setQueue([])
    setQueueIndex(0)
    sourceOrderRef.current = []
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setError(null)
  }, [])

  // Discord Rich Presence — update on track / play-state changes only (not every tick).
  useEffect(() => {
    const api = window.api?.discord
    if (!api) return

    if (!isPlaying || !currentTrack) {
      api.setPresence({ playing: false })
      return
    }

    const durationMs =
      typeof currentTrack.durationMs === 'number' && currentTrack.durationMs > 0
        ? currentTrack.durationMs
        : duration > 0
          ? Math.round(duration * 1000)
          : undefined

    api.setPresence({
      playing: true,
      title: currentTrack.title,
      artist: currentTrack.artistName,
      album: currentTrack.albumTitle,
      positionMs: Math.max(0, Math.round(currentTimeRef.current * 1000)),
      durationMs
    })
  }, [
    isPlaying,
    currentTrack?.id,
    currentTrack?.title,
    currentTrack?.artistName,
    currentTrack?.albumTitle,
    currentTrack?.durationMs,
    duration
  ])

  const togglePlayRef = useRef(togglePlay)
  const nextRef = useRef(next)
  const previousRef = useRef(previous)
  const seekRef = useRef(seek)
  const setVolumeRef = useRef(setVolume)
  const volumeRef = useRef(volume)
  const mutedRef = useRef(muted)
  const visualizerOpenRef = useRef(visualizerOpen)
  const seekStepRef = useRef(settings.playback.seekStepSeconds)
  const volumeStepRef = useRef(settings.playback.volumeStep)
  togglePlayRef.current = togglePlay
  nextRef.current = next
  previousRef.current = previous
  seekRef.current = seek
  setVolumeRef.current = setVolume
  volumeRef.current = volume
  mutedRef.current = muted
  visualizerOpenRef.current = visualizerOpen
  seekStepRef.current = settings.playback.seekStepSeconds
  volumeStepRef.current = settings.playback.volumeStep

  // Hardware media keys from main (globalShortcut) — works while Groove is in the background.
  useEffect(() => {
    const api = window.api?.playback
    if (!api?.onMediaCommand) return
    return api.onMediaCommand((command) => {
      if (command === 'toggle') togglePlayRef.current()
      else if (command === 'next') nextRef.current()
      else if (command === 'previous') previousRef.current()
    })
  }, [])

  // In-window player hotkeys (skip when typing or when the visualizer owns the arrows).
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      if (target.isContentEditable) return true
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    }

    const onKey = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return

      if (event.code === 'Space') {
        event.preventDefault()
        togglePlayRef.current()
        return
      }

      if (visualizerOpenRef.current) return

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        seekRef.current(currentTimeRef.current - seekStepRef.current)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        seekRef.current(currentTimeRef.current + seekStepRef.current)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setVolumeRef.current(Math.min(1, volumeRef.current + volumeStepRef.current))
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setVolumeRef.current(Math.max(0, volumeRef.current - volumeStepRef.current))
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Chromium Media Session — OS / keyboard media controls + now-playing metadata.
  useEffect(() => {
    const session = navigator.mediaSession
    if (!session) return

    if (!currentTrack) {
      session.metadata = null
      session.playbackState = 'none'
      return
    }

    const art = artworkUrl(currentTrack.artworkKey)
    session.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artistName ?? 'Unknown artist',
      album: currentTrack.albumTitle ?? '',
      artwork: art ? [{ src: art, sizes: '512x512' }] : []
    })
    session.playbackState = isPlaying ? 'playing' : 'paused'

    const onPlay = (): void => {
      if (!isPlaying) togglePlayRef.current()
    }
    const onPause = (): void => {
      if (isPlaying) togglePlayRef.current()
    }
    const onStop = (): void => {
      if (isPlaying) togglePlayRef.current()
    }

    try {
      session.setActionHandler('play', onPlay)
      session.setActionHandler('pause', onPause)
      session.setActionHandler('stop', onStop)
      session.setActionHandler('previoustrack', () => previousRef.current())
      session.setActionHandler('nexttrack', () => nextRef.current())
    } catch {
      /* some handlers unsupported */
    }

    return () => {
      try {
        session.setActionHandler('play', null)
        session.setActionHandler('pause', null)
        session.setActionHandler('stop', null)
        session.setActionHandler('previoustrack', null)
        session.setActionHandler('nexttrack', null)
      } catch {
        /* ignore */
      }
    }
  }, [
    currentTrack?.id,
    currentTrack?.title,
    currentTrack?.artistName,
    currentTrack?.albumTitle,
    currentTrack?.artworkKey,
    isPlaying
  ])

  const value = useMemo<PlaybackContextValue>(
    () => ({
      currentTrack,
      focusedTrack,
      focusTrack,
      queue,
      queueIndex,
      isPlaying,
      currentTime,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      error,
      queueOpen,
      setQueueOpen,
      playTrack,
      togglePlay,
      pause,
      next,
      previous,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      playNext,
      addToQueue,
      addTracksToQueue,
      removeFromQueue,
      clearQueue,
      jumpToQueueIndex,
      visualizerOpen,
      setVisualizerOpen,
      ensureAudioAnalyser,
      getAnalyserFrame,
      getVisualizerAudioGraph
    }),
    [
      currentTrack,
      focusedTrack,
      focusTrack,
      queue,
      queueIndex,
      isPlaying,
      currentTime,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      error,
      queueOpen,
      playTrack,
      togglePlay,
      pause,
      next,
      previous,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      playNext,
      addToQueue,
      addTracksToQueue,
      removeFromQueue,
      clearQueue,
      jumpToQueueIndex,
      visualizerOpen,
      ensureAudioAnalyser,
      getAnalyserFrame,
      getVisualizerAudioGraph
    ]
  )

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>
}

export function usePlayback(): PlaybackContextValue {
  const ctx = useContext(PlaybackContext)
  if (!ctx) {
    throw new Error('usePlayback must be used within PlaybackProvider')
  }
  return ctx
}
