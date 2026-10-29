import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LibraryProvider } from '@renderer/features/library'
import { PlaybackProvider, QueuePanel } from '@renderer/features/player'
import { PlaylistProvider } from '@renderer/features/playlists'
import { SettingsProvider } from '@renderer/features/settings'
import { SettingsModal } from '../settings/SettingsModal'
import { UpdateDialogHost } from '../ui/UpdateDialog'
import { CenterWorkspace } from './CenterWorkspace'
import { LeftSidebar } from './LeftSidebar'
import { PlayerFooter } from './PlayerFooter'
import { RightSidebar, type RightTabId } from './RightSidebar'
import { TitleBar } from './TitleBar'
import { readSession, SESSION_KEYS, writeSession } from '@renderer/lib/session'
import { setShellResizing } from '@renderer/lib/shellResize'
import './AppShell.css'

const LEFT_DEFAULT = 268
const LEFT_MIN = 200
const LEFT_MAX = 420
const LEFT_COLLAPSED = 72
const LEFT_SNAP = 160
const RIGHT_DEFAULT = 300
const RIGHT_MIN = 260
const RIGHT_MAX = 440
const GUTTER = 16

type DragSide = 'left' | 'right'

type ShellSession = {
  rightOpen: boolean
  rightTab: RightTabId
  leftCollapsed: boolean
  leftWidth: number
  rightWidth: number
}

const RIGHT_TABS: RightTabId[] = ['lyrics', 'about', 'related']

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function loadShellSession(): ShellSession {
  const raw = readSession<Partial<ShellSession>>(SESSION_KEYS.shell)
  const leftWidth =
    typeof raw?.leftWidth === 'number' ? clamp(raw.leftWidth, LEFT_MIN, LEFT_MAX) : LEFT_DEFAULT
  const rightWidth =
    typeof raw?.rightWidth === 'number' ? clamp(raw.rightWidth, RIGHT_MIN, RIGHT_MAX) : RIGHT_DEFAULT
  return {
    rightOpen: raw?.rightOpen !== false,
    rightTab: raw?.rightTab && RIGHT_TABS.includes(raw.rightTab) ? raw.rightTab : 'about',
    leftCollapsed: !!raw?.leftCollapsed,
    leftWidth,
    rightWidth
  }
}

function ShellFrame(): React.JSX.Element {
  const [initialShell] = useState(loadShellSession)
  const [rightOpen, setRightOpen] = useState(initialShell.rightOpen)
  const [rightTab, setRightTab] = useState<RightTabId>(initialShell.rightTab)
  const [leftCollapsed, setLeftCollapsed] = useState(initialShell.leftCollapsed)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rightRevealTick, setRightRevealTick] = useState(0)
  const [leftWidth, setLeftWidth] = useState(initialShell.leftWidth)
  const [rightWidth, setRightWidth] = useState(initialShell.rightWidth)
  const [dragging, setDragging] = useState<DragSide | null>(null)
  const [windowMaximized, setWindowMaximized] = useState(false)

  const bodyRef = useRef<HTMLDivElement>(null)
  const leftExpandedRef = useRef(initialShell.leftWidth)
  const rightExpandedRef = useRef(initialShell.rightWidth)
  const dragRef = useRef<{ side: DragSide; startX: number; startW: number } | null>(null)
  const rightOpenRef = useRef(initialShell.rightOpen)
  const liveRef = useRef({
    leftWidth: initialShell.leftWidth,
    rightWidth: initialShell.rightWidth,
    leftCollapsed: initialShell.leftCollapsed
  })
  const rafPaintRef = useRef(0)

  const paintColumns = useCallback(() => {
    const body = bodyRef.current
    if (!body) return
    const live = liveRef.current
    const leftCol = live.leftCollapsed ? LEFT_COLLAPSED : live.leftWidth
    body.style.gridTemplateColumns = rightOpenRef.current
      ? `${leftCol}px ${GUTTER}px minmax(0, 1fr) ${GUTTER}px ${live.rightWidth}px`
      : `${leftCol}px ${GUTTER}px minmax(0, 1fr)`
  }, [])

  const schedulePaint = useCallback(() => {
    if (rafPaintRef.current) return
    rafPaintRef.current = window.requestAnimationFrame(() => {
      rafPaintRef.current = 0
      paintColumns()
    })
  }, [paintColumns])

  useLayoutEffect(() => {
    rightOpenRef.current = rightOpen
    if (dragging) {
      paintColumns()
      return
    }
    liveRef.current = { leftWidth, rightWidth, leftCollapsed }
    paintColumns()
  }, [dragging, leftCollapsed, leftWidth, paintColumns, rightOpen, rightWidth])

  useEffect(() => {
    return () => {
      if (rafPaintRef.current) window.cancelAnimationFrame(rafPaintRef.current)
    }
  }, [])

  useEffect(() => {
    if (dragging) return
    writeSession(SESSION_KEYS.shell, {
      rightOpen,
      rightTab,
      leftCollapsed,
      leftWidth,
      rightWidth
    } satisfies ShellSession)
  }, [dragging, leftCollapsed, leftWidth, rightOpen, rightTab, rightWidth])

  const leftCol = leftCollapsed ? LEFT_COLLAPSED : leftWidth

  const toggleLeft = useCallback(() => {
    setLeftCollapsed((collapsed) => {
      if (!collapsed) {
        leftExpandedRef.current = liveRef.current.leftWidth
        liveRef.current.leftCollapsed = true
        return true
      }
      const restored = leftExpandedRef.current
      liveRef.current.leftWidth = restored
      liveRef.current.leftCollapsed = false
      setLeftWidth(restored)
      return false
    })
  }, [])

  const toggleRight = useCallback(() => {
    setRightOpen((open) => {
      if (open) {
        rightExpandedRef.current = liveRef.current.rightWidth
        return false
      }
      const restored = rightExpandedRef.current
      liveRef.current.rightWidth = restored
      setRightWidth(restored)
      return true
    })
  }, [])

  const beginResize = useCallback(
    (side: DragSide, event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const live = liveRef.current
      const startW =
        side === 'left'
          ? live.leftCollapsed
            ? LEFT_COLLAPSED
            : live.leftWidth
          : live.rightWidth
      if (side === 'left' && live.leftCollapsed) {
        live.leftCollapsed = false
        setLeftCollapsed(false)
      }
      dragRef.current = { side, startX: event.clientX, startW }
      setShellResizing(true)
      setDragging(side)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    []
  )

  useEffect(() => {
    if (!window.api?.window?.isMaximized) return
    void window.api.window.isMaximized().then(setWindowMaximized)
    return window.api.window.onMaximizedChange(setWindowMaximized)
  }, [])

  useEffect(() => {
    if (!dragging) return

    const onMove = (event: PointerEvent): void => {
      const drag = dragRef.current
      if (!drag) return
      const delta = event.clientX - drag.startX
      const live = liveRef.current

      if (drag.side === 'left') {
        const next = drag.startW + delta
        if (next < LEFT_SNAP) {
          leftExpandedRef.current = Math.max(LEFT_MIN, drag.startW)
          live.leftWidth = leftExpandedRef.current
          if (!live.leftCollapsed) {
            live.leftCollapsed = true
            setLeftCollapsed(true)
          }
          dragRef.current = {
            side: 'left',
            startX: event.clientX,
            startW: LEFT_COLLAPSED
          }
          schedulePaint()
          return
        }
        if (live.leftCollapsed) {
          live.leftCollapsed = false
          setLeftCollapsed(false)
        }
        const width = clamp(next, LEFT_MIN, LEFT_MAX)
        live.leftWidth = width
        leftExpandedRef.current = width
        schedulePaint()
        return
      }

      const next = clamp(drag.startW - delta, RIGHT_MIN, RIGHT_MAX)
      live.rightWidth = next
      rightExpandedRef.current = next
      schedulePaint()
    }

    const onUp = (): void => {
      const live = liveRef.current
      dragRef.current = null
      setLeftWidth(live.leftWidth)
      setRightWidth(live.rightWidth)
      setLeftCollapsed(live.leftCollapsed)
      setShellResizing(false)
      setDragging(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setShellResizing(false)
    }
  }, [dragging, schedulePaint])

  return (
    <div
      className={`app-shell${rightOpen ? '' : ' app-shell--right-collapsed'}${
        leftCollapsed ? ' app-shell--left-collapsed' : ''
      }${dragging ? ' app-shell--resizing' : ''}${
        windowMaximized ? ' app-shell--window-maximized' : ''
      }`}
    >
      <TitleBar
        leftCollapsed={leftCollapsed}
        onToggleLeft={toggleLeft}
        rightOpen={rightOpen}
        onToggleRight={toggleRight}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="app-shell__body" ref={bodyRef}>
        <div className="app-shell__pane app-shell__pane--left">
          <LeftSidebar collapsed={leftCollapsed} />
        </div>

        <div
          className="app-shell__resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize library sidebar"
          aria-valuenow={leftCol}
          aria-valuemin={LEFT_COLLAPSED}
          aria-valuemax={LEFT_MAX}
          onPointerDown={(event) => beginResize('left', event)}
        />

        <div className="app-shell__pane app-shell__pane--center">
          <CenterWorkspace />
        </div>

        {rightOpen && (
          <>
            <div
              className="app-shell__resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize now playing panel"
              aria-valuenow={rightWidth}
              aria-valuemin={RIGHT_MIN}
              aria-valuemax={RIGHT_MAX}
              onPointerDown={(event) => beginResize('right', event)}
            />
            <div className="app-shell__pane app-shell__pane--right">
              <RightSidebar
                tab={rightTab}
                onTabChange={setRightTab}
                revealTick={rightRevealTick}
              />
            </div>
          </>
        )}
      </div>
      <QueuePanel />
      <PlayerFooter
        onOpenRightLyrics={() => {
          setRightOpen(true)
          setRightWidth(rightExpandedRef.current)
          setRightTab('lyrics')
        }}
        onOpenNowPlaying={() => {
          setRightOpen(true)
          setRightWidth(rightExpandedRef.current)
          setRightTab('about')
          setRightRevealTick((n) => n + 1)
        }}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <UpdateDialogHost />
    </div>
  )
}

/** Top-level application chrome. */
export function AppShell(): React.JSX.Element {
  return (
    <SettingsProvider>
      <LibraryProvider>
        <PlaylistProvider>
          <PlaybackProvider>
            <ShellFrame />
          </PlaybackProvider>
        </PlaylistProvider>
      </LibraryProvider>
    </SettingsProvider>
  )
}
