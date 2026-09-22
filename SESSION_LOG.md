# NameSwipe — Session Log (2026-09-22)

A record of everything built and fixed in this session, in order. Branch:
`claude/iphone-baby-name-pwa-5049c8`. Live at
`https://eldersban.github.io/NameSwipe/`.

---

## 1. Initial build — iOS-native swipe PWA from scratch

Built from a blank repo per the attached planning conversation (`NameSwipe`
concept: swipe boy names left/right/up, separate "can I use it" from "do I
like it," never repeat a reviewed name).

**Stack chosen:** Vite + React + TypeScript + Tailwind CSS v4 + Framer
Motion + Zustand + `idb` (IndexedDB) + `vite-plugin-pwa`. Local-first, no
backend, no account.

**Data model** — the core architectural decision, kept separate throughout:
- `UserNameState.disposition`: `yes` / `maybe` / `no` — can I use this name?
- `UserNameState.liked`: independent boolean — do I like it stylistically?
- `UserNameState.rejectionReason`: why a "no" happened (`taste`, `family`,
  `friend`, `taken`, `association`, `surname_fit`, `other`). Availability
  reasons (family/friend/taken) do **not** count as a negative taste signal
  in the recommendation engine; only `taste` (or no reason given) does.

**Built:**
- Curated database of 259 boy names (nicknames, meaning, origin, style/trait
  tags, computed similar-name relationships) — `scripts/generate-names.mjs`
  → `scripts/curated-raw.mjs`
- Swipe deck (`SwipeCard.tsx`) — Framer Motion drag, velocity-aware
  thresholds, rotation, spring-back, keyboard arrow-key fallback
- Recommendation engine (`lib/recommend.ts`) — first ~30 cards are a
  style-balanced calibration spread; after that, a 70/20/10
  high-confidence/adjacent/wildcard mix scored from liked styles/traits
- Screens: **Discover**, **My Names** (with a "liked but can't use" smart
  filter), **Insights** (taste patterns, unlocks after 12 reviews),
  **Settings** (swipe direction, theme, haptics, surname preview,
  export/import backup, reset)
- Bottom-sheet name detail view: nicknames, meaning, similar names,
  "More like this," like toggle, decision buttons, notes
- Universal search with "Review now" (requeues any name to the front of
  the deck)
- Undo (survives across decisions), rejection-reason chip after a "no"
- IndexedDB persistence for everything (decisions, queue order, settings)
- PWA: manifest, iOS home-screen icons, service worker precaching —
  verified fully offline (service worker activates, app renders and is
  fully usable with the network disabled)
- 3-screen onboarding flow

Committed, pushed, and end-to-end tested with a headless browser (iPhone
viewport) covering swipe, undo, detail sheet, dark mode, search, and an
offline reload.

---

## 2. Clarifications

- Confirmed the "like it but can't use it" flow already existed: tap ♥
  before swiping No (optionally tag the reason as Family/Friend/etc.) —
  the algorithm keeps recommending that style without it counting as a
  taste rejection.
- Explained the name data was hand-authored, not pulled from an official
  database — set up the next step.

---

## 3. Real data, round 1 — U.S. Social Security Administration

Pulled the actual SSA baby-name dataset (real government birth-registry
counts, 1880–2016) via the `us-baby-names` npm package (this sandbox's
network policy blocks `ssa.gov` directly, but the npm registry is
reachable). Aggregated 2007–2016 male counts, cross-referenced against the
259 curated names (all 259 confirmed to be real registered names), and
added the 170 real top-300 names that were missing (Jayden, Joshua, Dylan,
Tyler, Christian, etc.) with authored nicknames/meanings — 429 names total,
with `popularityTier` now computed from real rank instead of a guess.

Extracted the curated list into `scripts/curated-raw.mjs` and added
`scripts/build-full-database.mjs` (`npm run db:build`) as the reproducible
generation pipeline.

---

## 4. Bug fix — Like button

**Report:** tapping ♥ sometimes opened the detail sheet instead of liking,
and liking an already-liked name was inconsistent.

**Root causes (two, both real):**
1. The card's own tap-to-open-details logic listened on `pointerdown`/
   `pointerup` on the whole card, including the Like button — tapping Like
   could also fire "open details."
2. Deeper bug: components read the current like state by calling the
   store's `isLiked(id)` action function inline during render, but only
   subscribed to that function reference (which never changes) — not to
   the underlying `pendingLikes` Set. Liking a name *before* swiping it
   updated the store correctly but never triggered a re-render, so the ♥
   silently failed to visually update.

**Fix:** the card's tap-detector now ignores any gesture starting on an
element marked `data-card-interactive`; `isLiked` reads were replaced with
direct reactive selectors (`s.decisions.get(id)?.liked ?? s.pendingLikes.has(id)`)
in `DiscoverScreen`, `NameDetailSheet`, and `SearchOverlay`. Verified 6/6
reliable toggles in a real browser session.

---

## 5. Real data, round 2 — user's global name database

User attached `namedb-all.numbers` (an Apple Numbers spreadsheet, 11,006
names: name / family / gender / meaning). Parsed with the `numbers-parser`
Python package (Numbers files are a zip of protobuf-encoded IWA files, not
plain text). Filtered to `gender ∈ {Male, Male/Female}` → 6,117 candidates,
deduped → 6,069 new names, merged with the existing 429 curated entries →
**6,227 unique names total**.

- Real SSA rank (already downloaded) now determines `popularityTier` for
  *every* name that's registered there, not just the original 300.
- For the ~5,800 names outside the curated set, `styles`/`traits` are
  derived from their family/origin tag and basic phonetics (vowel-ending →
  soft, family → classic/biblical/international); nicknames are left empty
  for those (the UI already hides the nicknames section gracefully when
  there are none).
- Source data committed under `scripts/sources/` (`namedb-male-raw.json`,
  `ssa-male-ranks.json`) so `npm run db:build` is fully reproducible later.
- Raised the service worker's precache size limit (dataset is now ~2.9 MB)
  and re-verified full offline mode still works; gzipped JS bundle is
  ~295 KB.

---

## 6. Gamification — achievements, streaks, themes

Added a full gamification layer tied to genuine usage, not arbitrary points:

- **18 achievements** across four categories — Milestones (first review,
  30 reviewed = "Calibrated," 100 = "Century Club," reviewing every name =
  "The Completionist"), Taste ("Big Heart" = 10 likes, "Bittersweet" = 5
  liked-but-can't-use, "Family Ties" = 5 ruled out for family while still
  liked), Habits (Undo ×10, "More like this" ×5, search ×10, a 7-day streak
  = "On a Roll," 30-day = "Dedicated"), Discovery ("Night Owl" = review
  between midnight–4am, "Early Bird" = before 7am, "Deep Cut" = review a
  rarest-tier name).
- **Day-streak tracking** (current + longest), persisted.
- **6 unlockable accent color themes** (Sage default, Blush, Midnight,
  Golden Hour, Botanical, Gilded) tied to specific achievements — swappable
  from a new Achievements screen, changes the app's `--accent` CSS
  variable live in both light and dark mode.
- Achievement-unlock toast (replaced the old one-off "first Yes" toast with
  a general mechanism covering all 18).
- New trophy button in the header opens the full-screen Achievements view:
  streak + unlock count, theme picker, full achievement list with lock
  state and unlock dates.
- All state round-trips through the existing export/import JSON backup.

Verified end-to-end in a real browser session (an achievement legitimately
unlocked "Night Owl" because the sandbox's clock happened to be in that
window — confirmed the hour-based logic is real, not simulated).

---

## 7. Bug fixes — detail sheet scrolling & status change

**Report:** couldn't scroll down in the name detail sheet to see similar
names; wanted to be able to change a name from Yes to No/Maybe after the
fact.

**Scrolling root cause:** the bottom sheet applied Framer Motion's
`drag="y"` (for swipe-to-dismiss) to the *same element* that scrolled its
own content — the drag gesture recognizer was capturing vertical touch
drags before the browser could scroll. Fixed by splitting the sheet into a
small drag handle (starts the dismiss gesture via `useDragControls`) and a
separate scrollable content area with no drag listener. Verified with a
real touch gesture: content scrolled from 0 → 282px, sheet stayed open.

**Status-change bug (real, found while implementing the fix):** the detail
sheet already had Yes/No/Maybe buttons, but `decide()` in the store
unconditionally removed one item from the front of the Discover queue
whenever the edit wasn't coming from the pinned queue — including when
called from My Names for an already-decided name nowhere near the front of
either queue. Changing a name's status from My Names silently skipped an
unrelated name out of the Discover deck. Fixed: `decide()`/`undo()` now
track exactly where (pinned queue, main queue, or neither) a name came from
and only mutate that specific list. Verified the Discover queue is
untouched when editing status from My Names.

Also added a visible highlight on whichever status button is currently
active, with the label "Your status — tap to change" once a decision
exists.

---

## 8. UX polish — rejection chip

**Report:** the "Why not?" prompt after a No swipe felt too obtrusive.

Replaced the large card (solid background, shadow, header row, wrapped
button grid) with a slim single-line translucent strip matching the nav
bar's blur style. Reasons sit in a horizontally-scrollable row; the chip
now auto-dismisses after 4 seconds if ignored instead of sitting there
indefinitely.

---

## 9. Live deployment — GitHub Pages

User wanted a permanent URL instead of running `npm run dev -- --host`
locally on the same Wi-Fi. Set up `.github/workflows/deploy-pages.yml`:
builds and deploys to GitHub Pages on every push to this branch.

- Made the manifest/icon paths relative (`start_url`, `scope`, icon `src`)
  instead of root-absolute, since Pages serves the project from a
  `/NameSwipe/` subpath rather than domain root.
- Verified by building with `--base=/NameSwipe/` and serving the output
  under an actual `/NameSwipe/` subpath locally: service worker registered
  with the correct scope, app rendered, and a full offline reload still
  worked. Default local build (no `--base` override) unaffected.
- GitHub's Pages-settings API isn't reachable through this sandbox's
  network policy, so enabling Pages (Settings → Pages → Source → "GitHub
  Actions") had to be done manually by the user, one time. First deploy
  attempt failed with a 404 until that was done; second run succeeded.

**Live URL:** `https://eldersban.github.io/NameSwipe/`

Confirmed: each device's activity (swipes, likes, streaks, achievements)
is stored only in that device's local IndexedDB — nothing syncs between
devices or people. A friend installed it on her iPhone home screen and her
data is fully isolated from the user's. Partner/shared-matches mode
(sketched in the original plan) was noted as a future feature, not built
yet.

---

## Where things are

```
scripts/
  curated-raw.mjs           hand-authored ~429 names (nicknames, meaning, styles)
  build-full-database.mjs   merges curated + namedb + SSA ranks → src/data/names.json
  generate-names.mjs        regenerates from curated-raw.mjs only (preview)
  sources/
    namedb-male-raw.json    from the user's namedb-all.numbers, filtered to male
    ssa-male-ranks.json     real SSA popularity rank per name (2007-2016, male)
src/
  components/               SwipeCard, NameDetailSheet, RejectionChip, SearchOverlay,
                             AchievementToast, AchievementsOverlay, Icons, ...
  screens/                  DiscoverScreen, MyNamesScreen, InsightsScreen, SettingsScreen
  store/useAppStore.ts      Zustand store — decisions, queue, undo, settings, gamification
  lib/                      db.ts (IndexedDB), recommend.ts, gamification.ts, haptics.ts
  data/names.json           the generated 6,227-name database (commit after npm run db:build)
  types/                    name.ts, settings.ts, gamification.ts
.github/workflows/
  deploy-pages.yml          builds + deploys to GitHub Pages on push
```

**Regenerating the name database** (only needed if you edit
`curated-raw.mjs` or the files under `scripts/sources/`):
```bash
npm run db:build
```

**Local dev:**
```bash
npm install
npm run dev -- --host
```
