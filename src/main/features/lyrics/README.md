# Lyrics feature (Phase 5)

Resolves lyrics in this order:

1. Sidecar `.lrc` / `.txt` / `.lyrics` next to the audio file
2. Embedded synchronized or plain lyrics via `music-metadata`

Enhanced / word-timed lyrics (`<mm:ss.xx>` stamps, `v1:` labels) are cleaned before display.
Word-sync SYLT crumbs are coalesced into phrase lines.

Renderer: `src/renderer/src/features/lyrics` (synced scroll in the right panel).
