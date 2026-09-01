---
target: Music library (/music)
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:/Users/alessandro/dev/cursor-dev/muzo/frontend/src/routes/music.tsx"
target_fingerprint: "sha256:c295a65f57824f2d57790c5177584cf124bb4a26d6110db71067ca552c7ceb31"
target_path: /Users/alessandro/dev/cursor-dev/muzo/frontend/src/routes/music.tsx
timestamp: 2026-09-01T07-59-41Z
slug: src-routes-music-tsx
---
⚠️ Assessments ran as two isolated sub-agents (A: design review · B: detector+browser). Neither sub-agent had browser automation, so there is **no live rendered evidence** — no screenshots, no dark-mode check, no computed-style verification, no in-page detector overlay. Everything below is from source (`music.tsx`, `track-list.tsx`, `music-table.tsx`, the full `data-table/` system, `filters/`, `page-shell.tsx`) plus the CLI detector, against a confirmed-running server. Treat visual-severity calls as provisional until someone looks at the rendered page.

# Critique — Music Library (`src/routes/music.tsx`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Page-change refetch deliberately suppresses the loading state ("avoid flickering" memo); no row count, no "X of Y tracks", no scan progress despite PRODUCT calling scanning core. |
| 2 | Match System / Real World | 2 | "Arousal" / "Valence" column headers are lab jargon for DJs; three mood columns where a crate-digger thinks "energy"; `Libray` typo in filter meta. |
| 3 | User Control and Freedom | 3 | Filter reset and sort reset exist; but `TrackMoreMenu` "Rescan (force)" and "Enhance with AI" fire on one click with no confirm and no undo. |
| 4 | Consistency and Standards | 2 | Two unsynced sort UIs (column-header dropdown + multi-sort popover builder); `border-dashed` filter chips match nothing else in the app's card language; hard `rounded` thumbnail vs system `rounded-md`/`rounded-xl`; `z-99999` magic values. |
| 5 | Error Prevention | 2 | Force-rescan / AI-enhance unguarded; slider filter silently rejects out-of-range typed input; `duration`, `listeningCount`, `lastScannedAt`, `fileCreatedAt` have `enableColumnFilter: true` but no `meta.variant` → dead filter registrations rendering nothing. |
| 6 | Recognition Rather Than Recall | 2 | 16 columns (3 hidden); to know what's filterable you open each dashed pill; Camelot color chips need a 30-entry legend that exists only in code; keyboard shortcuts (`z/q/s/d`+arrows) fully undiscoverable. |
| 7 | Flexibility and Efficiency | 3 | Multi-column sort, column visibility, URL-persisted state, keyboard nav all present and genuinely powerful — but hidden, and the `z/q/s/d` (AZERTY-WASD) map is unlabeled. |
| 8 | Aesthetic and Minimalist Design | 1 | Worst axis. ~18 dashed filter buttons + View + Sort, 16-column table with 100–180px truncated cells, rainbow Camelot chips, mono readouts everywhere. Nothing recedes. Directly contradicts "low on chrome so the music does the talking." |
| 9 | Error Recovery | 2 | Backend-down renders bare "No results." in a 24-unit cell — indistinguishable from empty library or over-narrow filter. No retry, no diagnostic. |
| 10 | Help and Documentation | 1 | None. No empty-state guidance, no tooltip on "Arousal", no shortcut legend, no first-scan onboarding; `View Details` menu item is a no-op. |
| **Total** | | **20/40** | **Poor — major UX rework required** |

Every heuristic applies (Operate surface); no `n/a`.

## Design Specificity Verdict

**LLM assessment (Assessment A):** This is a near-stock **shadcn/diceui "data-table" starter, lightly re-skinned** — not a surface authored for Muzo. The tells are all through the source: `DataTableToolbar`, `DataTableSortList` (drag-handle multi-sort builder), `DataTableViewOptions`, `DataTableFacetedFilter`, `DataTableSliderFilter`, the `dataTableConfig` operator dictionary, leftover `'use client'` directives, commented-out "row(s) selected" scaffolding — shipped essentially as-authored upstream. The only Muzo-specific gestures are the 32px album-art thumbnail and the Camelot-key color chips, and **both fight the design system**: the Camelot palette adds ~30 saturated colors (One Voice Rule violation), and the thumbnail is `h-8 w-8 rounded` — the smallest element on a screen whose north star is "album art is the hero." "The Crate Room" promises an album-art-forward, low-chrome, pillowy room; what renders is a 16-column dense spreadsheet with truncated cells and a wall of dashed pills. Swap the column labels and it's a CRM or a logs viewer. **Category-interchangeable.**

**Deterministic scan (Assessment B):** Detector exit 2 — **41 findings**, all `advisory`/`quality`, across 2 rules:
- **`design-system-color` — 38 findings**, all in `music-table.tsx` lines 67–100, the `CamelotKeyOptions` rainbow (`rgba(221,160,221,0.5)` … `rgba(255,20,147,0.5)`, 12 distinct hues). **Partial false positive**: the Camelot Wheel is a real harmonic-mixing convention, so this is data-encoded color, not style drift — but the finding is technically correct (these hues are nowhere in DESIGN.md) and it corroborates the P0 below. The detector also surfaced a **real source bug at line 96**: two object entries on one line (`'D minor'` followed by a duplicated `'F# minor'` fragment) — a bad paste.
- **`design-system-font-size` — 3 findings** (legit, not false positives): `text-[0.7rem]` on the Esc-hint `<kbd>` in `data-table-action-bar.tsx:146`; `text-[10.4px]` (plus `h-[18.24px] rounded-[3.2px] px-[5.12px]`) on the count badge in **both** `data-table-filter-list.tsx:200` and `data-table-sort-list.tsx:151` — byte-identical, one copied pattern. The oddly-precise values look like a global scale transform applied to shadcn defaults — real design-system drift. DESIGN.md type floor is `0.75rem`.

No detector findings for spacing, radius, shadows, chrome hex, touch targets, or contrast. `music.tsx`, `track-list.tsx`, `filters/*`, and the rest of `data-table/*` are mechanically clean.

**Where A and B agree:** the Camelot palette is the single loudest problem — A calls it a One Voice Rule violation on design grounds, B flags all 38 instances mechanically. **Where B caught what A's summary underweighted:** the line-96 malformed source and the systematic sub-floor badge sizing from a scale transform. **No visual overlay** is available — no reliable user-visible highlight exists this run; fallback signal is the CLI scan only.

## Overall Impression

The engineering under this screen is serious — URL-persisted state, `content-visibility` virtualization, hand-tuned memo comparators, keyboard playback. The **design** is a stock template that actively contradicts the design system you just wrote. The single biggest opportunity: **design the row as a card first** — cover art + title/artist + the 3–4 values a DJ actually mixes on (BPM, key, energy) — and demote the 16-column grid to an opt-in "Table view" for power users. That one move fixes the specificity verdict, the aesthetic score, and most of the cognitive-load failures at once.

## What's Working

1. **URL-persisted filter/sort/pagination state** (`nuqs` + `validateSearch` zod schema in `music.tsx`). A DJ can bookmark "128–132 BPM, 8A, energetic" and return to it or share it — exactly right for "preparation is the job," and real engineering.
2. **Keyboard-driven row playback + pagination** (`music-table.tsx` keydown effect: arrows + `z/q/s/d` to step tracks/pages, with correct `isTypingTarget` guarding so it never fires inside inputs or menus). The instinct — audition a crate without the mouse — is precisely the power-user need. It just needs to be visible.
3. **`content-visibility:auto` + `contain-intrinsic-size` on every row**, plus `React.memo` with hand-written comparators throughout. "Built for scale / tens of thousands of tracks" is taken seriously at the render layer.

## Priority Issues

### [P0] The surface contradicts its own design system's core thesis
- **Why it matters:** "The Crate Room" is album-art-forward and low-chrome; this is maximal-chrome and art-free. A DESIGN.md the product won't honor on its flagship Operate screen isn't a design system, and DJs comparing Muzo to Rekordbox see zero differentiation.
- **Fix:** Introduce a card/row hybrid as the default view — 56–64px cover (`rounded-md`), title + artist stacked, and only BPM / key / energy as mono chips on the right. Move the 16-column grid behind an explicit "Table view" toggle. Kill top pagination; one row of *grouped* filters.
- **Suggested command:** `$impeccable shape`

### [P0] One Voice Rule violated by the Camelot key palette
- **Why it matters:** `CamelotKeyOptions` hard-codes ~30 saturated `rgba` fills applied as `backgroundColor` on key badges across every visible row. DESIGN.md: periwinkle is the *only* accent, ≤10% of screen, "if a screen needs a second color, the layout is wrong." The rainbow blows the entire color budget and makes the one wayfinding accent meaningless. Detector confirms all 38 instances; line 96 is also malformed source.
- **Fix:** Render keys as neutral mono badges (`variant="outline"`, `font-mono`) by default. If harmonic color is valuable, make it an opt-in "Camelot colors" toggle using a single-hue lightness ramp (like `chart-1`–`chart-5`), or color *only* the selected key's compatible neighbors. Fix the line-96 paste error.
- **Suggested command:** `$impeccable colorize`

### [P1] No scan status or incomplete-track surfacing — a core product loop is invisible
- **Why it matters:** PRODUCT.md principle 5 is "Surface the incomplete… never hidden," and the scan is a long-running job that "must show scan state." This screen shows neither. Backend-down and mid-scan both collapse to "No results."
- **Fix:** Persistent status strip above the table: scan progress ("Analyzing 412 / 3,180"), a count of incomplete tracks with a one-click filter to them, and a distinct error state ("Can't reach the library service — Retry") separate from empty. Give the empty library its own onboarding state ("Point Muzo at a music folder to begin").
- **Suggested command:** `$impeccable onboard`

### [P1] Aesthetic overload — the toolbar is a wall of ~18 identical dashed buttons
- **Why it matters:** Fails cognitive-load items 1, 2, 4, 6, and 8 simultaneously. A decision point with 18 ungrouped options is where users freeze. The skeleton literally hard-codes `filterCount={18}`.
- **Fix:** Collapse to one text search + a small set of *primary* inline filters in the DJ's vocabulary (Genre, BPM, Key, Energy) + an "All filters" button opening the existing `FilterSheet` for the rest, grouped under headings (Musical / Mood / Metadata / Library). Merge the two sort mechanisms into one.
- **Suggested command:** `$impeccable distill`

### [P2] Accessibility failures against the stated WCAG 2.1 AA target
- **Why it matters:** Explicit product commitment. Concrete breaks: every thumbnail is `alt="Album Art"` (10 identical announcements/page); the faceted-filter clear control is `<div role="button">` nested inside a `<button>` (invalid interactive nesting); Camelot chips use low-contrast `rgba(…,0.5)` fills over a light card and convey key partly through color (fails 1.4.3 / 1.4.1); the favorite cell is red-heart-icon-only with no text alternative; keyboard shortcuts can't be discovered or disabled; focus is likely lost to `<body>` after pagination.
- **Fix:** Real `<button>` for filter-clear; meaningful or empty alt text; key badges that pass 3:1 non-text contrast or drop color; `aria-label` on the favorite cell; a visible "?" shortcut legend; an axe pass on the rendered page.
- **Suggested command:** `$impeccable harden`

## Persona Red Flags

**Alex (power user, large messy library):**
- `z/q/s/d`+arrow shortcuts are undiscoverable — the feature built *for* Alex is invisible to him.
- Default page size 10 on a 10k-track library ≈ 1,000 pages; no jump-to-page, no infinite scroll, no "load 200".
- The two sort UIs don't sync — a column-header sort doesn't populate the multi-sort builder, so Alex can't tell what state he's in.
- Truncated 100px `artist`/`title` cells force hover-to-read on the data he scans fastest.
- Dead filter registrations on `duration`/`listeningCount`/dates — "tracks I've never played" is unfilterable.

**Sam (accessibility):**
- `<div role="button">` inside `<button>` in every active faceted filter — nested interactive, unreliable focus order.
- Camelot chips: `rgba(x,y,z,0.5)` fills fail non-text contrast; key is partly color-coded with no legend.
- `alt="Album Art"` ×10 per page.
- No focus management after pagination (page changes silently).
- Favorite = red heart icon only, no text alternative.

**Mara, the harmonic-mixing set-builder** (derived from PRODUCT.md — prepares sets off-gig, retrieves by key/BPM/energy, thinks in the Camelot wheel):
- The Key column shows a color but not the *compatible* keys — she still runs the wheel in her head; the color is noise that doesn't do her job.
- BPM and Key are columns 8–9, often off-screen-right behind horizontal scroll on a laptop — her two most important fields are the least visible.
- No bulk crate-building from a filtered view — `TrackMoreMenu` is one track at a time; the row-selection scaffolding is commented out.
- "Energy" is split across three lab-named columns — she can't just ask for "peak-time stuff."
- Her two always-used filters (BPM range, Key) aren't inline by default — she opens pills to reach them.

## Minor Observations

- Typo: filter meta `label: 'Libray'` in `music-table.tsx`.
- `mfValenceMood` column title is "Mood"; `mfArousalMood` meta label is also "Mood" — two columns, same name.
- `DataTableSortList` `onKeyDown` effect has an unconditional `return;` on line 1 — the whole `s`/`Shift+s` shortcut block is dead code (corroborates B's `data-table-sort-list.tsx` finding area).
- `initialState.sorting` is `[{id:'title'}]` in `music-table.tsx` but the route default is `[{id:'fileCreatedAt', desc:true}]` — the table's initial sort doesn't match the URL.
- `apiUrl('/api/images/serve?imagePath=Unknown Image')` fallback fires a broken image request for every artless track; no `onError` placeholder.
- `z-99999`, `z-[1001]` magic z-indexes scattered across menus — a stacking-context problem waiting to happen.
- `'use client'` directives are inert cargo from the shadcn/Next origin.
- Skeleton renders top pagination (`withTopPagination`) but the live table doesn't — loading and loaded states disagree.
- `View Details` menu item has no `onClick`.
- Duration cell doesn't pad `minutes` and has no hour handling for long DJ mixes.
- Sub-floor badge sizing (`text-[10.4px]`, `h-[18.24px]`, `rounded-[3.2px]`) in filter-list and sort-list count badges — from a scale transform, per detector; should snap to the `0.75rem` / `rounded-sm` tokens.

## Questions to Consider

1. If "album art is the hero," why is the largest thing on this screen a dashed filter button and the smallest a 32px thumbnail? What does this screen look like if you design the *card* first and add the table only as an escape hatch?
2. The design system says "if a screen needs a second color, the layout is wrong." The Camelot wheel genuinely needs ~12 colors. Is the honest conclusion that harmonic mixing deserves its own dedicated view (a wheel, a "compatible now" rail) rather than a table column?
3. PRODUCT.md says the scan is central and must show state — but the screen a user stares at during a scan shows none. Is the Music Library the wrong home for scan status, or is it just missing?
4. You built keyboard playback nobody can discover and disabled the row-selection code that would let someone build a crate from a filter. Which is the real power-user feature, and why is the built one hidden and the useful one commented out?
5. For a DJ with 10,000 tracks and 20 minutes between sets, is "everything available at once" actually the same as "nothing usable"?
