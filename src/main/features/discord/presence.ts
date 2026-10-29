/**
 * Discord Rich Presence — connects to the local Discord desktop client via IPC.
 * Safe to call when Discord is closed; reconnects in the background.
 */
import { Client, StatusDisplayType } from '@xhayper/discord-rpc'
import { ActivityType } from 'discord-api-types/v10'
import { DISCORD_CLIENT_ID } from '../../../shared/constants/discord'
import type { DiscordPresencePayload } from '../../../shared/types/discord'
import { lookupCoverUrl } from './coverLookup'

const RECONNECT_MS = 15_000

let client: Client | null = null
let ready = false
let connecting = false
let destroyed = false
let reconnectTimer: ReturnType<typeof setInterval> | null = null
let lastPayload: DiscordPresencePayload | null = null
/** Bumps when presence input changes so stale cover lookups are ignored. */
let applyGeneration = 0

function truncate(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function payloadFingerprint(payload: DiscordPresencePayload): string {
  return [
    payload.playing ? '1' : '0',
    payload.title ?? '',
    payload.artist ?? '',
    payload.album ?? ''
  ].join('\u0001')
}

async function setActivityForPayload(
  payload: DiscordPresencePayload,
  coverUrl: string | null
): Promise<void> {
  if (!client?.user || !ready) return

  if (!payload.playing || !payload.title) {
    await client.user.clearActivity()
    return
  }

  const title = truncate(payload.title || 'Unknown track', 128)
  const artist = truncate(payload.artist || '', 128)
  const positionMs =
    typeof payload.positionMs === 'number' && payload.positionMs >= 0
      ? payload.positionMs
      : 0
  const durationMs =
    typeof payload.durationMs === 'number' && payload.durationMs > 0
      ? payload.durationMs
      : null

  // Visible text = song + artist only. Album is used for cover lookup, not display.
  const activity: Parameters<NonNullable<typeof client.user>['setActivity']>[0] = {
    type: ActivityType.Listening,
    details: title,
    statusDisplayType: StatusDisplayType.DETAILS
  }

  if (artist) {
    activity.state = artist
  }

  // Do not set largeImageText — Listening activities render it as a third
  // visible line, which duplicates the song title.
  if (coverUrl) {
    activity.largeImageKey = coverUrl
  }

  if (durationMs != null) {
    const start = Date.now() - positionMs
    activity.startTimestamp = start
    activity.endTimestamp = start + durationMs
  } else {
    activity.startTimestamp = Date.now() - positionMs
  }

  await client.user.setActivity(activity)
}

async function applyPresence(payload: DiscordPresencePayload): Promise<void> {
  if (!client?.user || !ready) return

  const generation = ++applyGeneration
  const fingerprint = payloadFingerprint(payload)

  // Show text immediately; upgrade with cover when the lookup finishes.
  await setActivityForPayload(payload, null)

  if (!payload.playing || !payload.title) return

  const coverUrl = await lookupCoverUrl({
    artist: payload.artist,
    title: payload.title,
    album: payload.album
  })

  if (destroyed || generation !== applyGeneration) return
  if (!lastPayload || payloadFingerprint(lastPayload) !== fingerprint) return

  if (coverUrl) {
    await setActivityForPayload(payload, coverUrl)
  }
}

async function connect(): Promise<void> {
  if (destroyed || ready || connecting) return
  connecting = true

  try {
    const next = new Client({ clientId: DISCORD_CLIENT_ID })

    next.on('ready', () => {
      ready = true
      connecting = false
      if (lastPayload) {
        void applyPresence(lastPayload).catch(() => {
          /* Discord may reject a stale payload; next update will retry */
        })
      }
    })

    next.on('disconnected', () => {
      ready = false
      connecting = false
      client = null
    })

    client = next
    await next.login()
  } catch {
    ready = false
    connecting = false
    client = null
  }
}

function ensureReconnectLoop(): void {
  if (reconnectTimer || destroyed) return
  reconnectTimer = setInterval(() => {
    if (!ready && !connecting && !destroyed) {
      void connect()
    }
  }, RECONNECT_MS)
  // Do not keep the process alive solely for Discord reconnects.
  reconnectTimer.unref?.()
}

/** Start Discord RPC (no-op if already started). */
export function startDiscordPresence(): void {
  destroyed = false
  ensureReconnectLoop()
  void connect()
}

/** Update or clear presence from the current playback state. */
export function updateDiscordPresence(payload: DiscordPresencePayload): void {
  lastPayload = payload
  if (!ready) {
    void connect()
    return
  }
  void applyPresence(payload).catch(() => {
    ready = false
    client = null
    void connect()
  })
}

/** Tear down the Discord RPC client on app quit. */
export async function stopDiscordPresence(): Promise<void> {
  destroyed = true
  applyGeneration += 1
  if (reconnectTimer) {
    clearInterval(reconnectTimer)
    reconnectTimer = null
  }
  lastPayload = null
  try {
    if (client?.user && ready) {
      await client.user.clearActivity()
    }
  } catch {
    /* ignore */
  }
  try {
    await client?.destroy()
  } catch {
    /* ignore */
  }
  client = null
  ready = false
  connecting = false
}
