# Notes

## 2026-07-06

### Notes

- **Redesigned Home as a daily dashboard** and restructured navigation:
  - Home now greets by name and time of day, shows today's verse, streak/entry/mood widgets, a tappable 7-day week strip, a primary CTA, and a compact peony-meanings strip above the brand signature.
  - The original full peony page (title, script, alternating meaning blocks) moved to close out the User Guide instead of living on Home.
  - Desktop sidebar keeps Guide near the top; mobile bottom bar now expands to six icons (Home, Today, Calendar, Goals, Routines, More), with Write/Guide/Gallery/Recap/Sync moved into the More drawer.
  - Trimmed font families 8 → 5 (dropped Playfair Display, Quicksand, Josefin Sans); the writing-font picker now offers four options with automatic fallback for anyone who had one of the removed fonts selected.
  - Fixed a type-scale flat spot (`fs-lg`/`fs-xl` were equal; now 1.25rem/1.5rem).
  - Darkened muted text across all six light themes for more readable small labels.
  - Added proper PWA icons (PNG maskable icons + apple-touch-icon, replacing SVG-only), manifest updated with rosewater colors and `#today` as the start URL.
- **Removed the printable-journal product files from the repo** and added a `.gitignore` entry for `product/` — those files must never be publicly served alongside the web app.
- **Added an opt-out toggle for the day-streak widget**: a "Display" section in the font/settings (Aa) picker with a switch to hide the streak counter, stored in `localStorage` (`journal_show_streak`), plus a User Guide tip pointing people to it.
- Same commit also swapped the streak/entries/mood widget icons from emoji to inline line-art SVGs (matching the Goals/Recap icon style from earlier), and replaced the flat "Entry saved ✨" toast with one of ~18 rotating faith-centered messages — an affirmation for an okay/good day (rating > 5) or a gentler comfort message for a hard day (rating 1–5), each avoiding an immediate repeat.
- Cache-busting bumped to `?v=37` across CSS/JS and the apple-touch-icon.

### Testing notes

**Home redesign & navigation:**
- [ ] Home shows: name+time-of-day greeting, today's verse, streak/entries/mood widgets, 7-day week strip (tappable — confirm tapping a day jumps to that day's entry), primary CTA, peony-meanings strip above the brand signature
- [ ] User Guide now ends with the full peony page (title, script, alternating meaning blocks) — confirm it reads well as a closing section
- [ ] Mobile bottom nav shows exactly 6 icons: Home, Today, Calendar, Goals, Routines, More
- [ ] "More" drawer contains Write, Guide, Gallery, Recap, Sync — all still reachable and functional
- [ ] Desktop sidebar still has Guide near the top
- [ ] Writing-font picker shows only 4 fonts now — if you previously had Playfair Display/Quicksand/Josefin Sans selected, confirm it falls back gracefully (no broken/blank font state)
- [ ] Check `fs-lg`/`fs-xl` text sizes actually look distinct now, not identical
- [ ] Muted/small label text is legible in all 6 light themes (not just Rosewater)
- [ ] "Add to Home Screen" (iOS Safari or Android Chrome) shows the real peony icon, not a blank tile
- [ ] Confirm one reload after deploy picks up everything (`?v=37`)

**Product files removal:**
- [ ] Nothing in the live app actually depends on the `product/` folder (it was print-only journal source material) — spot check the app still loads/functions normally after this removal

**Day-streak opt-out toggle:**
- [ ] Open the **Aa** (font) button → new "Display" section at the top with a "Day streak" switch, on by default
- [ ] Toggle it off — the day-streak widget disappears from Home (and Today's entry widgets, since `entry.js` shares the same widget markup)
- [ ] Toggle back on — streak reappears
- [ ] Preference persists across reloads (stored in `localStorage`)
- [ ] User Guide's first card now has a tip mentioning this toggle

**Entry save messages:**
- [ ] Save an entry with a day rating above 5 (or no rating) — should show a rotating affirmation (e.g. "Good job showing up today 🌸"), not always the same one twice in a row
- [ ] Save an entry with a day rating 1–5 — should show a gentler comfort message (e.g. "Hard days count too — thank you for showing up 🤍")
- [ ] Confirm the message doesn't repeat back-to-back across consecutive saves

**Widget icons:**
- [ ] Streak/entries/mood widget icons on Home and Today are now line-art SVGs instead of emoji (🌸📖✨) — check they render at consistent size and inherit theme color correctly across all themes including Midnight

**⚠️ Still worth re-checking — unresolved from earlier:**
- [ ] Given how much navigation/Home restructuring just happened, re-verify the Daily Routines page actually renders (category cards + task list, not just the header) — it was reported blank on 2026-07-04 and the root cause was never confirmed. If still blank, check DevTools Console for an error after `"Page init failed for #routines"`.

## 2026-07-04

### Notes

- Added a 7th theme, **Lemon** (warm cream/honey palette), including its own night-mode variant and cursor tint.
- Added a **Daily Routines** guide card to the onboarding/help screen explaining sections, recurrence types, the until-date option, and the Tomorrow preview.
- Replaced the passive "Google session expired" toast with a persistent **Drive reconnect banner** (📎) that has a one-click "Reconnect" button — re-runs the Google OAuth handshake in place instead of requiring a full sign-out/sign-in.
- Bumped cache-busting query strings to `?v=24` and the service worker cache to `journal-v26` so the above ships cleanly to existing users.
- Fixed the Stripe webhook (`supabase/functions/stripe-webhook`), which had stopped receiving events since July 1:
  - Supabase's default JWT verification was rejecting Stripe's unauthenticated webhook POSTs with 401 — disabled via `supabase/config.toml` (`verify_jwt = false`), scoped to `stripe-webhook` only (`create-checkout` still requires a valid user session token, unchanged).
  - `stripe.webhooks.constructEvent` doesn't work in Deno (its crypto provider is async-only) — switched to `constructEventAsync`.
  - The `STRIPE_WEBHOOK_SECRET` stored in Supabase had trailing whitespace from a copy-paste — re-set it clean.
  - Verified end-to-end with a real test checkout: webhook returned 200, and `user_subscriptions.is_paid` correctly flipped to `true` for that user.

### Testing notes

**⚠️ Known open issue — verify first, not yet fixed:**
- [ ] Daily Routines page reported rendering completely blank (only the static header showed, no category cards or task list). Root cause not yet found — if it still reproduces, open DevTools → Console, reload the page, and capture whatever error appears after `"Page init failed for #routines"` so it can be pinned down.

**Lemon theme:**
- [ ] Palette picker shows Lemon after Sky, before Midnight
- [ ] Selecting it: warm cream background, gold accents, matching cursor tint
- [ ] Night mode under Lemon shows the warm honey-amber dark variant, not muddy/olive
- [ ] Onboarding guide's theme section says "seven palettes" and shows a Lemon swatch chip

**Daily Routines guide card:**
- [ ] New card appears in the onboarding/help guide, between an existing card and Recap
- [ ] Copy and icon render correctly, no broken markup

**Drive reconnect banner:**
- [ ] Trigger an expired Google Drive token (or wait ~1hr signed in with Google) — persistent banner appears with a Reconnect button, not just a toast
- [ ] Clicking Reconnect re-runs Google OAuth in place and dismisses/refreshes access
- [ ] No duplicate banners stack if triggered more than once
- [ ] A failed reconnect (e.g. blocked popup) shows a toast instead of failing silently

**Cache-busting:**
- [ ] One reload after deploy is enough to pick up all changes (`?v=24`, `journal-v26`)

**Stripe webhook — already confirmed working, no action needed:**
- [x] JWT verification disabled for `stripe-webhook` only
- [x] `constructEventAsync` fix deployed
- [x] Webhook secret re-set without whitespace
- [x] Verified via real test checkout — 200 response, `user_subscriptions` row correctly updated
