# NameSwipe

An iPhone-first progressive web app for choosing a baby name. Swipe through
boy names — left for no, up for maybe, right for yes — and tap the ♥ to mark
a name you love even if you can't use it. Built as a fast, native-feeling PWA
that works fully offline once installed.

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Framer Motion for the swipe gestures and transitions
- Zustand for app state
- IndexedDB (via `idb`) for local-first persistence — no account, no server
- `vite-plugin-pwa` for the manifest, service worker, and offline caching

## Product model

Every name carries two independent signals, kept deliberately separate:

- **Disposition** — `yes` / `maybe` / `no`: could I actually use this name?
- **Taste** (`liked`) — do I like it stylistically, regardless of whether I
  can use it?

That split is what lets you swipe "no" on your brother's name while still
telling the recommendation engine "keep showing me names like this."

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL on your iPhone (same Wi-Fi network) or in a
desktop browser's mobile emulation. From Safari on iPhone: **Share → Add to
Home Screen** to install it as a standalone app.

```bash
npm run build     # production build + service worker
npm run preview   # serve the production build locally
```

## Project layout

```
src/
  components/   Reusable UI: swipe card, bottom sheet, chips, icons
  screens/      Discover, My Names, Insights, Settings
  store/        Zustand store — decisions, queue, undo, settings
  lib/          IndexedDB persistence, recommendation engine, haptics
  data/         Curated boy-name database (names.json + typed loader)
  types/        Shared TypeScript types
```
