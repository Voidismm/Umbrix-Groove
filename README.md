# Umbrix Groove

Local-first gothic desktop music player. Own your library. Play offline. No account required.

## New here?

Start with **[docs/FOLDER_MAP.md](docs/FOLDER_MAP.md)** — it explains where every folder lives in plain English.

## Stack

- Electron + Vite + React + TypeScript
- SQLite for the library index
- `music-metadata` for tags and artwork

## Develop

```bash
npm install
npm run dev
```

Use the Electron window. Browser-only localhost cannot access your music folders.

## Project map (short)

```
src/main        → backend (files, database, scanning)
src/preload     → safe bridge to the UI
src/renderer    → React UI (pages, layout, features)
src/shared      → shared types + constants
docs/           → guides for humans
```

## Phase status

| Phase | Status |
| --- | --- |
| 1 UI shell | Done |
| 2 Local library index | Done |
| 3 Playback | Done |
| 4 Playlists | Done |
| 5 Lyrics | Done |
| 6 Settings persistence | Done |
| Home listening rails + daily mixes | In progress |
