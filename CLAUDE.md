# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Another Day, another chance" — a personal, faith-centered journaling web app. Pure HTML/CSS/vanilla JS, no build step, no package manager, no framework.

## Running it

Serve the directory with any static file server (the app fetches `data/scriptures.json` via `fetch()` and loads the Supabase JS client from a CDN, so it must be served over HTTP, not opened as `file://`):

```bash
python3 -m http.server 8765
```

Then open `http://localhost:8765`. There is no build, lint, or test tooling in this repo — changes to HTML/CSS/JS are reflected on a page reload (a service worker caches assets in production — see "PWA / service worker" below for what that means for local testing).

Sign-in is required to use the app (see "Auth is mandatory" below); use the "Preview the app" link on the login screen to explore without an account.

## Architecture

### No bundler, scripts loaded in dependency order

`index.html` loads every script as a plain `<script src="...">` tag, in this exact order (see bottom of `index.html`):

```
supabase-config.js → auth.js → crypto.js → drive.js → payment.js → db.js → scripture.js → router.js →
home.js → entry.js → freewrite.js → calendar.js → goals.js → routines.js → recap.js → gallery.js → app.js
```

Each module attaches its public API to `window` (e.g. `window.JournalDB`, `window.Router`, `window.EntryPage`) instead of using ES modules or a bundler. There is no import/export — cross-module calls go through these global namespaces. When adding a new module, append its `<script>` tag in `index.html` *before* `app.js` (which wires up routes in `launchJournal()`) and *after* anything it depends on. Also add the new file to the `SHELL` list in `sw.js` so it gets precached.

`js/firebase-config.js` is a leftover from a previous backend and is **not loaded** by `index.html` — the app runs on Supabase now (see below). Don't wire it back in without checking with the user first.

### Hash router + page sections

`js/router.js` is a minimal hash-based router: `Router.register('#route', handler)` maps a hash to an init function, and `handleRoute()` toggles `.page-section.active` on `<div id="section-{route}">` elements in `index.html`. Pages are plain functions with an `init()` that re-renders their section's DOM from scratch — there's no virtual DOM or component framework. Each page module follows the same shape: `window.XxxPage = { init }` (see `home.js`, `entry.js`, `calendar.js`, `goals.js`, `routines.js`, `recap.js`, `gallery.js`, `freewrite.js`).

Routes are registered in `js/app.js` → `launchJournal()`.

Pages that carry navigation state across `init()` calls (`calendar.js`, `goals.js`, `routines.js`, `recap.js` — all have a "prev/next month or day" cursor) wrap their whole file in an IIFE so that state lives in a closure instead of `window`; simpler pages with no persistent nav state (`home.js`, `entry.js`, `freewrite.js`, `gallery.js`) don't bother. Follow whichever pattern matches the page you're adding to.

### Storage: Supabase + IndexedDB (`js/db.js`)

`JournalDB` writes to IndexedDB always, and additionally to Supabase (Postgres) when the user is logged in and not in preview mode (`useSupabase()`):

- **Text data** (`entries`, `goals`, `recap`, `routines`, `routine_log`, `routine_sections` tables) is end-to-end encrypted client-side (see `js/crypto.js`) before it's written to Supabase, and decrypted on read — the payload column is opaque JSON (`{_enc, iv, ct}`) that the server never sees in plaintext.
- **Media (photos/videos) always stays in IndexedDB** — `entryForCloud()`/the `entries` upsert strip full media down to Drive pointers (`{driveId, type, name}`, no image bytes) before encrypting, because Postgres/Supabase rows aren't meant to hold multi-MB blobs. For **Google-authenticated users only**, `js/drive.js` additionally uploads the original file to a folder in the user's own Google Drive (via the OAuth `provider_token` Supabase captured at sign-in) so photos can follow the account across devices; the Drive file ID is what rides along as the pointer. Email/password users have no Drive token, so their media stays device-local only.
- **Daily Routines** (`routines`, `routineLog` IndexedDB stores) sync the same way as goals/recap: `routines` is one Supabase row per item (upsert on `user_id, routine_id`; deletes remove the row), `routine_log` is one row per date, and the section list (names/colors) — which lives in `localStorage`, not IndexedDB, since it has no natural per-row key — mirrors to a single `routine_sections` row per user. Cross-device deletion of individual routines isn't reconciled on pull (a routine deleted on device A can reappear if device B never pulled the delete) — a known limitation, not yet worth the complexity given how rarely items are deleted.
- Supabase failures fall back silently to IndexedDB (`console.warn` + continue) — don't let an offline/permission error break the UI.
- The manual **Sync button** (`wireSyncButton` in `js/app.js` → `JournalDB.syncFromCloud()`) pulls all cloud rows down, retries any pending Drive uploads that missed their backup, and downloads any Drive-hosted photo this device doesn't have yet.

IndexedDB (`journalDB`, versioned in `IDB_VERSION`) has five object stores: `entries` (keyPath `date`), `goals` (keyPath `monthKey`), `recap` (keyPath `monthKey`), `routines` (keyPath `id`), `routineLog` (keyPath `date`).

### Client-side encryption (`js/crypto.js`)

All entry/goals/recap data is encrypted with AES-GCM before it leaves the browser; the key is derived via PBKDF2 from a passphrase (email users: their login password; Google users: a separate passphrase prompted for by `showPassphraseModal()` in `js/app.js`) plus a random per-user salt stored in the `user_keys` Supabase table. The Supabase project owner cannot read journal contents. The derived raw key is cached in `sessionStorage` for the tab session (`restoreKeyFromSession`) so the passphrase isn't re-asked on every reload, but is never sent to the server. Losing the passphrase (Google users) means losing access to that data — there's no recovery path.

### Auth is mandatory, with a view-only preview mode

`js/auth.js` wraps Supabase Auth (Google OAuth + email/password) and renders a self-contained login overlay (`#login-overlay` / `#login-form-area`) by swapping `innerHTML` between `signin` / `signup` / `reset` modes. Unlike a legacy guest mode, the app now requires sign-in for real use; the login screen's "Preview the app" link instead sets `window._guestMode = window._viewOnly = true`, which lets someone browse the UI but `wrapSavesForViewOnly()` in `js/app.js` makes every save throw instead of writing anything.

`initApp()` in `js/app.js` sequences startup: theme → scriptures → auth resolution → DB open → (if real login) unlock encryption key → payment/trial check → launch. Google's OAuth access token (needed for Drive) is short-lived (~1hr) and Supabase doesn't refresh it automatically; expect `js/drive.js` calls to fail with `authExpired` after a while and surface a "sign in again" toast rather than erroring loudly.

### Trial + paywall (`js/payment.js`, `supabase/functions/`)

New accounts get a 14-day trial (`user_subscriptions` table, checked by `Payment.checkAccess()` on every launch). Past the trial without an active subscription, `Payment.showPaymentWall()` blocks the app behind a Stripe Checkout flow. The Checkout session and the Stripe webhook that marks a subscription active both run server-side as Supabase Edge Functions (`supabase/functions/create-checkout`, `supabase/functions/stripe-webhook`) — no Stripe secret key is ever present in client code, only the publishable key in `js/supabase-config.js`.

### PWA / service worker

`sw.js` precaches the app shell (every JS/CSS file plus a couple of assets, listed explicitly in `SHELL`) under a versioned cache name (`journal-vNN`) and uses a network-first fetch strategy so updates show up without a double-reload; Supabase/Stripe/Google API requests are explicitly passed through to the network, never cached. `manifest.json` makes the app installable. **When adding or removing a JS/CSS file, update `SHELL` in `sw.js` too, and bump the `?v=NN` query strings on the `<link>`/`<script>` tags in `index.html` together with `CACHE` in `sw.js`** — otherwise returning users can get stuck on stale cached assets.

### Styling

CSS is split by concern and loaded in this order: `variables.css` (design tokens — colors, fonts, spacing as custom properties) → `base.css` → `layout.css` → `components.css` → `pages.css` → `animations.css`. Theming (`rosewater`, `lavender`, `mint`, `peach`, `sky`, `midnight`) is done via `data-theme` on `<html>`, swapping the values of the CSS custom properties defined in `variables.css`; see `applyTheme()`/`initThemePicker()` in `js/app.js`.

### Daily/monthly scripture rotation

`js/scripture.js` loads `data/scriptures.json` (falls back to an in-file `FALLBACK_SCRIPTURES` array if the fetch fails) and deterministically picks a verse by day-of-year (`getDailyScripture`) or by `(month + year) % length` (`getMonthlyScripture`) — no randomness, so the same date always shows the same verse.
