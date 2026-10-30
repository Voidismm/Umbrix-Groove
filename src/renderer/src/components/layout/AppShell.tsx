import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { LibraryProvider } from '@renderer/features/library'
import { PlaybackProvider, usePlayback } from '@renderer/features/player'
import { PlaylistProvider } from '@renderer/features/playlists'
import { SettingsProvider } from '@renderer/features/settings'
import { AppearanceEditor } from '../settings/AppearanceEditor'
import { SettingsModal } from '../settings/SettingsModal'
import { GrooveTipHost } from '../ui/GrooveTipHost'
import { ChangelogDialogHost } from '../ui/ChangelogDialog'
import { UpdateDialogHost } from '../ui/UpdateDialog'
import { CenterWorkspace } from './CenterWorkspace'
import { LeftSidebar } from './LeftSidebar'
import { PlayerFooter } from './PlayerFooter'
import { RightSidebar, type RightTabId } from './RightSidebar'
import { TitleBar } from './TitleBar'
import { readSession, SESSION_KEYS, writeSession } from '@renderer/lib/session'
import {
  OPEN_SETTINGS_EVENT,
  type OpenSettingsDetail,
  type SettingsFocusTarget
} from '@renderer/lib/settingsNav'
import { setShellResizing } from '@renderer/lib/shellResize'
import { NavHistoryBridge } from '@renderer/app/NavHistoryBridge'
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
  const { queueRevealTick } = usePlayback()
  const [initialShell] = useState(loadShellSession)
  const [rightOpen, setRightOpen] = useState(initialShell.rightOpen)
  const [rightTab, setRightTab] = useState<RightTabId>(initialShell.rightTab)
  const [leftCollapsed, setLeftCollapsed] = useState(initialShell.leftCollapsed)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsFocus, setSettingsFocus] = useState<SettingsFocusTarget | null>(null)
  const [appearanceEditorOpen, setAppearanceEditorOpen] = useState(false)
  const [rightRevealTick, setRightRevealTick] = useState(0)
  const [leftWidth, setLeftWidth] = useState(initialShell.leftWidth)
  const [rightWidth, setRightWidth] = useState(initialShell.rightWidth)
  const [windowMaximized, setWindowMaximized] = useState(false)

  const shellRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const leftExpandedRef = useRef(initialShell.leftWidth)
  const rightExpandedRef = useRef(initialShell.rightWidth)
  const lastNonQueueTabRef = useRef<Exclude<RightTabId, 'queue'>>(
    initialShell.rightTab === 'queue' ? 'about' : initialShell.rightTab
  )
  const dragRef = useRef<{ side: DragSide; startX: number; startW: number } | null>(null)
  const draggingRef = useRef(false)
  /** Left gutter dragged past snap — collapse only on release so expanded chrome is not crushed mid-drag. */
  const leftSnapCollapseRef = useRef(false)
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
    if (draggingRef.current) {
      paintColumns()
      return
    }
    liveRef.current = { leftWidth, rightWidth, leftCollapsed }
    paintColumns()
  }, [leftCollapsed, leftWidth, paintColumns, rightOpen, rightWidth])

  useEffect(() => {
    return () => {
      if (rafPaintRef.current) window.cancelAnimationFrame(rafPaintRef.current)
    }
  }, [])

  useEffect(() => {
    const onOpenSettings = (event: Event): void => {
      const detail = (event as CustomEvent<OpenSettingsDetail>).detail
      setSettingsFocus(detail?.focus ?? null)
      setSettingsOpen(true)
    }
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpenSettings)
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpenSettings)
  }, [])

  const rightTabRef = useRef(rightTab)
  rightTabRef.current = rightTab

  useEffect(() => {
    if (!queueRevealTick) return
    const current = rightTabRef.current
    if (current === 'lyrics' || current === 'about' || current === 'related') {
      lastNonQueueTabRef.current = current
    }
    setRightOpen(true)
    setRightWidth(rightExpandedRef.current)
    setRightTab('queue')
  }, [queueRevealTick])

  useEffect(() => {
    if (draggingRef.current) return
    writeSession(SESSION_KEYS.shell, {
      rightOpen,
      rightTab: rightTab === 'queue' ? lastNonQueueTabRef.current : rightTab,
      leftCollapsed,
      leftWidth,
      rightWidth
    } satisfies ShellSession)
  }, [leftCollapsed, leftWidth, rightOpen, rightTab, rightWidth])

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
      event.stopPropagation()
      if (draggingRef.current) return
      // Collapsed rail is icon-only — expand via the titlebar toggle, not the gutter.
      if (side === 'left' && liveRef.current.leftCollapsed) return

      const live = liveRef.current
      const startW = side === 'left' ? live.leftWidth : live.rightWidth
      const target = event.currentTarget

      dragRef.current = { side, startX: event.clientX, startW }
      draggingRef.current = true
      leftSnapCollapseRef.current = false
      // Defer heavy resize mode until the pointer actually moves — a click must not
      // strip motion / contain and flash the chrome.
      let resizeModeOn = false
      target.setPointerCapture(event.pointerId)

      const armResizeMode = (): void => {
        if (resizeModeOn) return
        resizeModeOn = true
        setShellResizing(true)
        shellRef.current?.classList.add('app-shell--resizing')
      }

      const onMove = (moveEvent: PointerEvent): void => {
        const drag = dragRef.current
        if (!drag) return
        const delta = moveEvent.clientX - drag.startX
        if (!resizeModeOn && Math.abs(delta) < 3) return
        armResizeMode()
        const nextLive = liveRef.current

        if (drag.side === 'left') {
          const next = drag.startW + delta
          if (next < LEFT_SNAP) {
            // Keep expanded chrome at LEFT_MIN while dragging — collapse on pointer up.
            leftSnapCollapseRef.current = true
            leftExpandedRef.current = Math.max(LEFT_MIN, drag.startW)
            nextLive.leftWidth = LEFT_MIN
            nextLive.leftCollapsed = false
            schedulePaint()
            return
          }
          leftSnapCollapseRef.current = false
          nextLive.leftCollapsed = false
          const width = clamp(next, LEFT_MIN, LEFT_MAX)
          nextLive.leftWidth = width
          leftExpandedRef.current = width
          schedulePaint()
          return
        }

        const width = clamp(drag.startW - delta, RIGHT_MIN, RIGHT_MAX)
        nextLive.rightWidth = width
        rightExpandedRef.current = width
        schedulePaint()
      }

      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        const nextLive = liveRef.current
        const snapCollapse = leftSnapCollapseRef.current
        dragRef.current = null
        draggingRef.current = false
        leftSnapCollapseRef.current = false
        // One React sync after the gesture — never during it.
        if (snapCollapse) {
          nextLive.leftCollapsed = true
          nextLive.leftWidth = leftExpandedRef.current
        }
        // Commit collapsed chrome + column width before clearing resize mode so
        // filters / contain do not restore onto a half-width expanded rail.
        flushSync(() => {
          setLeftWidth(nextLive.leftWidth)
          setRightWidth(nextLive.rightWidth)
          setLeftCollapsed(nextLive.leftCollapsed)
        })
        paintColumns()
        if (resizeModeOn) {
          shellRef.current?.classList.remove('app-shell--resizing')
          setShellResizing(false)
        }
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [paintColumns, schedulePaint]
  )

  useEffect(() => {
    if (!window.api?.window?.isMaximized) return
    void window.api.window.isMaximized().then(setWindowMaximized)
    return window.api.window.onMaximizedChange(setWindowMaximized)
  }, [])

  return (
    <div
      ref={shellRef}
      className={`app-shell${rightOpen ? '' : ' app-shell--right-collapsed'}${
        leftCollapsed ? ' app-shell--left-collapsed' : ''
      }${windowMaximized ? ' app-shell--window-maximized' : ''}`}
    >
      <NavHistoryBridge />
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
          aria-disabled={leftCollapsed || undefined}
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
                onTabChange={(next) => {
                  if (next !== 'queue') lastNonQueueTabRef.current = next
                  setRightTab(next)
                }}
                onLeaveQueue={() => {
                  setRightTab(lastNonQueueTabRef.current)
                }}
                revealTick={rightRevealTick}
              />
            </div>
          </>
        )}
      </div>
      <PlayerFooter
        queueActive={rightOpen && rightTab === 'queue'}
        onToggleQueue={() => {
          if (rightOpen && rightTab === 'queue') {
            setRightTab(lastNonQueueTabRef.current)
            setRightOpen(true)
            setRightWidth(rightExpandedRef.current)
            return
          }
          if (rightTab !== 'queue') {
            lastNonQueueTabRef.current = rightTab
          }
          setRightOpen(true)
          setRightWidth(rightExpandedRef.current)
          setRightTab('queue')
        }}
        onOpenRightLyrics={() => {
          lastNonQueueTabRef.current = 'lyrics'
          setRightOpen(true)
          setRightWidth(rightExpandedRef.current)
          setRightTab('lyrics')
        }}
        onOpenNowPlaying={() => {
          lastNonQueueTabRef.current = 'about'
          setRightOpen(true)
          setRightWidth(rightExpandedRef.current)
          setRightTab('about')
          setRightRevealTick((n) => n + 1)
        }}
      />
      <SettingsModal
        open={settingsOpen}
        focusTarget={settingsFocus}
        onClose={() => {
          setSettingsOpen(false)
          setSettingsFocus(null)
        }}
        onFocusHandled={() => setSettingsFocus(null)}
        onEditAppearance={() => {
          setSettingsOpen(false)
          setSettingsFocus(null)
          setAppearanceEditorOpen(true)
        }}
      />
      <AppearanceEditor
        open={appearanceEditorOpen}
        onClose={() => setAppearanceEditorOpen(false)}
      />
      <UpdateDialogHost />
      <ChangelogDialogHost />
      <GrooveTipHost />
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
