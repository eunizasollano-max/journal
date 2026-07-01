# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Another Day, another chance" — a personal, faith-centered journaling web app. Pure HTML/CSS/vanilla JS, no build step, no package manager, no framework.

## Running it

Serve the directory with any static file server (the app fetches `data/scriptures.json` via `fetch()`, so it must be served over HTTP, not opened as `file://`):

```bash
python3 -m http.server 8765
```

Then open `http://localhost:8765`. There is no build, lint, or test tooling in this repo — changes to HTML/CSS/JS are reflected on a page reload.

## Architecture

### No bundler, scripts loaded in dependency order

`index.html` loads every script as a plain `<script src="...">` tag, in this exact order (see bottom of `index.html`):

```
firebase-config.js → auth.js → db.js → scripture.js → router.js →
home.js → entry.js → freewrite.js → calendar.js → goals.js → recap.js → gallery.js → app.js
```

Each module attaches its public API to `window` (e.g. `window.JournalDB`, `window.Router`, `window.EntryPage`) instead of using ES modules or a bundler. There is no import/export — cross-module calls go through these global namespaces. When adding a new module, append its `<script>` tag in `index.html` *before* `app.js` (which wires up routes in `launchJournal()`) and *after* anything it depends on.

### Hash router + page sections

`js/router.js` is a minimal hash-based router: `Router.register('#route', handler)` maps a hash to an init function, and `handleRoute()` toggles `.page-section.active` on `<div id="section-{route}">` elements in `index.html`. Pages are plain functions with an `init()` that re-renders their section's DOM from scratch — there's no virtual DOM or component framework. Each page module follows the same shape: `window.XxxPage = { init }` (see `home.js`, `entry.js`, `calendar.js`, `goals.js`, `recap.js`, `gallery.js`, `freewrite.js`).

Routes are registered in `js/app.js` → `launchJournal()`.

### Dual-backend storage (`js/db.js`)

`JournalDB` transparently chooses between IndexedDB (local) and Firestore (cloud) per call:

- **Guest mode** (`FIREBASE_ENABLED = false`, the default) or **not logged in**: everything goes to IndexedDB only.
- **Logged in + Firebase enabled**: text data syncs to Firestore at `users/{uid}/{collection}/{id}`; **media (photos/videos) always stays in IndexedDB** because Firestore has a 1 MB document limit. `entryForCloud()` strips `media` and replaces it with `mediaCount` before writing to Firestore; reads merge the local `media` array back onto the cloud document.
- Firestore failures fall back silently to IndexedDB (`console.warn` + continue) — don't let an offline/permission error break the UI.

IndexedDB has three object stores: `entries` (keyPath `date`), `goals` (keyPath `monthKey`), `recap` (keyPath `monthKey`).

### Firebase is optional and disabled by default

`js/firebase-config.js` holds `FIREBASE_CONFIG` (placeholder values) and `FIREBASE_ENABLED` (currently `false`). With it `false`, `js/auth.js` and `js/db.js` skip all Firebase calls and the app runs in guest/local-only mode — this is the expected state for local development unless real Firebase credentials have been configured. Don't assume Firebase is reachable; always check `window.FIREBASE_ENABLED` before relying on `firebase.*` APIs, matching the existing pattern in `auth.js`/`db.js`.

### Auth flow

`js/auth.js` wraps Firebase Auth (Google popup + email/password) and renders a self-contained login overlay (`#login-overlay` / `#login-form-area`) by swapping `innerHTML` between `signin` / `signup` / `reset` modes. `initApp()` in `js/app.js` sequences startup: theme → scriptures → (if Firebase) auth resolution → DB open → launch.

### Styling

CSS is split by concern and loaded in this order: `variables.css` (design tokens — colors, fonts, spacing as custom properties) → `base.css` → `layout.css` → `components.css` → `pages.css` → `animations.css`. Theming (`blush`, `lavender`, `mint`, `peach`, `sky`) is done via `data-theme` on `<html>`, swapping the values of the CSS custom properties defined in `variables.css`; see `applyTheme()`/`initThemePicker()` in `js/app.js`.

### Daily/monthly scripture rotation

`js/scripture.js` loads `data/scriptures.json` (falls back to an in-file `FALLBACK_SCRIPTURES` array if the fetch fails) and deterministically picks a verse by day-of-year (`getDailyScripture`) or by `(month + year) % length` (`getMonthlyScripture`) — no randomness, so the same date always shows the same verse.
