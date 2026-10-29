import { useCallback, useEffect, useRef, useState } from 'react'
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

  const leftExpandedRef = useRef(initialShell.leftWidth)
  const rightExpandedRef = useRef(initialShell.rightWidth)
  const dragRef = useRef<{ side: DragSide; startX: number; startW: number } | null>(null)

  useEffect(() => {
    writeSession(SESSION_KEYS.shell, {
      rightOpen,
      rightTab,
      leftCollapsed,
      leftWidth,
      rightWidth
    } satisfies ShellSession)
  }, [leftCollapsed, leftWidth, rightOpen, rightTab, rightWidth])

  const leftCol = leftCollapsed ? LEFT_COLLAPSED : leftWidth
  const columns = rightOpen
    ? `${leftCol}px ${GUTTER}px minmax(0, 1fr) ${GUTTER}px ${rightWidth}px`
    : `${leftCol}px ${GUTTER}px minmax(0, 1fr)`

  const toggleLeft = useCallback(() => {
    setLeftCollapsed((collapsed) => {
      if (!collapsed) {
        leftExpandedRef.current = leftWidth
        return true
      }
      setLeftWidth(leftExpandedRef.current)
      return false
    })
  }, [leftWidth])

  const toggleRight = useCallback(() => {
    setRightOpen((open) => {
      if (open) {
        rightExpandedRef.current = rightWidth
        return false
      }
      setRightWidth(rightExpandedRef.current)
      return true
    })
  }, [rightWidth])

  const beginResize = useCallback(
    (side: DragSide, event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startW =
        side === 'left' ? (leftCollapsed ? LEFT_COLLAPSED : leftWidth) : rightWidth
      if (side === 'left' && leftCollapsed) {
        setLeftCollapsed(false)
      }
      dragRef.current = { side, startX: event.clientX, startW }
      setDragging(side)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [leftCollapsed, leftWidth, rightWidth]
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

      if (drag.side === 'left') {
        const next = drag.startW + delta
        if (next < LEFT_SNAP) {
          leftExpandedRef.current = Math.max(LEFT_MIN, drag.startW)
          setLeftCollapsed(true)
          setLeftWidth(leftExpandedRef.current)
          dragRef.current = {
            side: 'left',
            startX: event.clientX,
            startW: LEFT_COLLAPSED
          }
          return
        }
        setLeftCollapsed(false)
        const width = clamp(next, LEFT_MIN, LEFT_MAX)
        setLeftWidth(width)
        leftExpandedRef.current = width
        return
      }

      const next = clamp(drag.startW - delta, RIGHT_MIN, RIGHT_MAX)
      setRightWidth(next)
      rightExpandedRef.current = next
    }

    const onUp = (): void => {
      dragRef.current = null
      setDragging(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging])

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
      <div className="app-shell__body" style={{ gridTemplateColumns: columns }}>
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
