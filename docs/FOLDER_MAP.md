# Umbrix Groove — Folder Map

Read this first if you are new to the codebase. Every folder has one job.

## Top level

| Path | What lives here |
| --- | --- |
| `src/main/` | Electron **backend** — files, database, scanning (Node privileges) |
| `src/preload/` | Tiny **bridge** between backend and UI (safe API only) |
| `src/renderer/` | The **UI** — React screens, styles, buttons |
| `src/shared/` | **Types/constants** used by main + UI (no Electron, no React) |
| `docs/` | Human docs like this file |

---

## `src/main` (backend)

| Path | Job |
| --- | --- |
| `app/` | Window creation, protocol registration, app bootstrap helpers |
| `db/` | SQLite database + migrations |
| `db/migrations/` | Numbered schema changes (`001_…`, `002_…`) |
| `features/library/` | Scan folders, read tags, cache artwork, query tracks |
| `features/playback/` | *(Phase 3)* Real audio playback |
| `features/playlists/` | Playlist folders, likes, ratings, tags |
| `features/lyrics/` | Local LRC/TXT sidecars + embedded lyrics |
| `features/discover/` | *(Later)* Music discovery / downloads |
| `ipc/` | IPC handlers the UI can call (`window`, `library`, …) |
| `index.ts` | Main entry — keep this file short |

---

## `src/preload` (bridge)

| Path | Job |
| --- | --- |
| `api/window.ts` | Minimize / maximize / close |
| `api/library.ts` | Library calls (add folder, search, scan…) |
| `api/playlists.ts` | Playlist / folder / like / rating calls |
| `index.ts` | Exposes `window.api` to the UI |
| `index.d.ts` | TypeScript types for `window.api` |

---

## `src/renderer/src` (UI)

| Path | Job |
| --- | --- |
| `app/` | App root + navigation config |
| `pages/` | One screen per file (Home, Songs, Albums…) |
| `components/layout/` | Shell chrome (title bar, sidebars, footer) |
| `components/ui/` | Reusable widgets (Icon, …) |
| `features/library/` | Library UI pieces + library React state |
| `features/player/` | Player UI extras (queue, playback state) |
| `features/playlists/` | Playlist tree, playlist track table, playlist state |
| `features/settings/` | Persisted Settings modal prefs (appearance, playback, …) |
| `styles/` | Design tokens + global CSS |
| `assets/` | Images / logos |
| `assets/icons/` | UI SVG pack (sourced from repo-root `icons/`) |
| `lib/` | Small pure helpers (format time, artwork URLs) |

---

## `src/shared`

| Path | Job |
| --- | --- |
| `types/` | Shared TypeScript interfaces |
| `constants/` | Shared constants (audio extensions, etc.) |

---

## Rule of thumb

- Need disk / database? → `src/main`
- Need a button or page? → `src/renderer`
- Need a type both sides use? → `src/shared`
- Never put Node `fs` code inside `renderer`
