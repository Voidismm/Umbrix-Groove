/** Payload the renderer sends when playback presence should change. */
export interface DiscordPresencePayload {
  playing: boolean
  title?: string
  artist?: string
  album?: string
  /** Elapsed position in ms — used for the activity timestamp when playing. */
  positionMs?: number
  /** Track length in ms — enables the Spotify-style progress range when set. */
  durationMs?: number
}
