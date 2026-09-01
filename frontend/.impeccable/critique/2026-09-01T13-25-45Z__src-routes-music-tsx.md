---
target: src/routes/music.tsx (post-redesign)
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:/Users/alessandro/dev/cursor-dev/muzo/frontend/src/routes/music.tsx"
target_fingerprint: "sha256:987eee331b2b11abc013f9b44600f8fe2a88ffcded4b52b610e1c047aa078b7a"
target_path: /Users/alessandro/dev/cursor-dev/muzo/frontend/src/routes/music.tsx
timestamp: 2026-09-01T13-25-45Z
slug: src-routes-music-tsx
---
Method: dual-agent (A: design review · B: detector + browser). Both ran as isolated parallel sub-agents against the live logged-in dev server (real data, dark theme). Light-theme spot checks and a mobile screenshot were skipped (session rendered dark; tab group auto-closed after the desktop pass).

# Critique — Music Library (`src/routes/music.tsx`), post-redesign

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | `LibraryStatusStrip` + "last scan" line are solid; background refetch has no indicator (`isFetching` swallowed unless data empties). |
| 2 | Match System / Real World | 3 | Camelot wheel + DJ-ordered tile metadata are excellent — but tiles say "E minor" while the wheel says "9A": two notations, never reconciled. |
| 3 | User Control and Freedom | 3 | URL-persisted filters/sort/view; clear affordances. No undo/rollback on the optimistic favorite toggle. |
| 4 | Consistency and Standards | 2 | Two sort models (column headers in table, popover button in cards) that never show the same state. Header carries 4 controls with 3 visual treatments. |
| 5 | Error Prevention | 3 | Constrained pick-list facets; the `busy`/`libraryEmpty`/`noMatches` disambiguation in `music-view.tsx` is careful work. |
| 6 | Recognition Rather Than Recall | 3 | Facet chips show active selection inline; "Energy" buckets ("Moderate Energy") are unexplained ordinals with no legend. |
| 7 | Flexibility and Efficiency | 3 | Keyboard nav, preload-on-intent, URL state — but the arrows move the *playing* track, not a focus cursor: you can't keyboard-browse without hijacking audio. |
| 8 | Aesthetic and Minimalist Design | 2 | Card view clean. Table view: subgenre column is a wall of filled periwinkle badges — ~15–20% of the light viewport is accent. One Voice Rule re-violated. |
| 9 | Error Recovery | 3 | `NoData` states are specific and actionable ("Can't reach the library service… Retry"); harmonic's "full-library search is coming" is honest. |
| 10 | Help and Documentation | 3 | The "?" popover surfaces the keyboard map (the exact P2 fix) — but it's a 24px ghost icon, easy to miss, and lists only 4 of the real shortcuts. |
| **Total** | | **28/40** | **Fair (upper end)** — baseline was 20/40 Poor |

All 10 heuristics apply (Operate surface).

## Design Specificity Verdict

**LLM assessment (A):** The redesign genuinely moved from category-interchangeable toward **authored for Muzo** — but only the **card view and the harmonic view** earned it. `track-tile.tsx` is a real crate-room object: album art hero at `aspect-square`, info strip leading with the three values a DJ sorts on live (BPM → Camelot → energy), chrome receding, on-system rounding and shadow. Beside the old stock shadcn spreadsheet it's a different product — you can browse by sleeve now. The **Camelot wheel** is the strongest single artifact in the app: a domain coordinate system rendered as the thing DJs actually use, multi-hue palette correctly quarantined to the one screen where it *is* the content, compatible keys lit while everything else drops to `opacity-20`, and a "Mixes with 8A · A minor / 7A · D minor…" legend that teaches the concept.

**But** the default view is still `table`, and the table is still a 13-column data-grid that reads as "any admin panel." The redesign built the crate room next door and left the front door opening onto the spreadsheet. And the table's subgenre column re-introduced an accent-color problem in a new form.

**Deterministic scan (B):** detector exit 2 — **40 findings** (down from 41), all `advisory`/`quality`, two rules:
- **33 × `design-system-color`**, all in `src/components/track/track-feature-options.ts:41–74` — the Camelot key `rgba()` palette. **Mostly a false positive relocated**: the 38 findings that were in `music-table.tsx` last run moved here when the palette was extracted to the shared module (imported by `music-table.tsx` + `track-tile.tsx`); the wheel's traditional hues are a documented design decision. Net −5 (file de-dupes enharmonic keys).
- **7 × `design-system-font-size`**: `camelot-wheel.tsx:110,148` (wheel-graphic tick labels — false positive, same exemption); **genuine (3):** `data-table-action-bar.tsx:146` (`0.7rem`), `data-table-filter-list.tsx:200` and `data-table-sort-list.tsx:123` (`10.4px`) — sub-floor micro-labels in vendored diceui-style components (DESIGN.md floor is `0.75rem`).
- **Gone:** the prior run's Camelot findings *in `music-table.tsx`* (that P0 is genuinely resolved at that location) and its 3 sub-floor font sizes.

**Browser overlay (B, injection succeeded):** cards view `37 anti-patterns`, table view `46`. Dominant finding: **`low-contrast` 2.5:1** (need 4.5:1) — `#ffffff` on `#90a0e6`, i.e. `text-primary-foreground` white on `bg-primary` periwinkle — the **default `Badge` variant**, ~40 instances/page (every subgenre pill in the table). Also: `p.text-muted-foreground.text-sm` at 3.9:1 (need 4.5:1); `edge-flush-cards` / `cramped-padding` / `nested-cards` all on the `overflow-x-auto` table wrapper `div`; `flat-type-hierarchy` (12/14/16px, 1.3:1 ratio) in the table.

**Computed-style spot checks (B, dark theme):** font-family Plus Jakarta Sans ✓ everywhere; button radius 18px (`rounded.md`) ✓; play button + track-tile card use exact `dark-primary` / `dark-card` tokens ✓; radii on-scale ✓. **Partial:** card + play-button `box-shadow` is `…0.18) 2px 2px 10px 4px, …0.18) 2px 1px 2px 3px` — 18% opacity is *at* the DESIGN ceiling and the second `2px 1px 2px 3px` layer is a near-crisp offset (borderline vs "The No Hard Edge Rule"). `body` background bleeds from a parent (`bg-secondary` class), not a `background` token.

**Where A and B agree:** the table's filled-periwinkle badges are the loudest problem — A calls it a One Voice Rule re-violation on design grounds, B measures it at 2.5:1 contrast × ~40 instances. **Where B caught what A didn't:** the exact contrast ratio (it's an *accessibility* failure, not only an aesthetic one), and the 3 genuine sub-floor font sizes. **No reliable overlay screenshot** of light theme or mobile.

## Overall Impression

A real, substantial redesign that **built the right thing and then didn't route users to it.** Card view and the Camelot wheel are genuinely delightful and specific; the table — still the default — is the surface that scored 20/40. The single biggest opportunity: **default `view` to `cards`** and **change the subgenre badge variant**. Those two one-line changes credibly push this to 32–33.

## What's Working

1. **`track-tile.tsx` metadata ordering** — BPM → Camelot → energy is the DJ's mental model, not "artist/album/year." Mono font correctly reserved for BPM/key. The design system working as intended.
2. **Camelot wheel palette discipline** — the 12-hue positional color lives *only* in `camelot-wheel.tsx` with an explicit code comment; compatible keys stay lit, the rest drop to `opacity-20`; the "Mixes with…" legend teaches the concept. Restrained and correct.
3. **Empty/error/loading rigor in `music-view.tsx`** — `busy` vs `noRows` vs `libraryEmpty` vs `noMatches`, each with distinct copy/icon/CTA, plus the "refetch emptied data → show skeleton not empty state" guard. Principle 5 ("surface the incomplete") is served by `LibraryStatusStrip`.

## Cognitive Load — 5 of 8 items fail

**FAIL:** one-primary-action (header has 4 equal `variant="outline"` controls, none primary), ≤4 options at a decision point (filter bar = 7 controls; sheet = 8 fields), consistent interaction (sort differs table vs cards), visual hierarchy (table: flat 1.3:1 type ratio), working memory (13 columns, Key clipped off-screen at 1440w).
**PASS:** progressive disclosure (4 inline facets + sheet is the right move), recognition, sub-100ms feedback.

**Decision points >4 options:** filter bar (7) · filter sheet (8 fields) · table columns (13) · Camelot wheel (24 segments — acceptable, spatial tool not a menu).

## Priority Issues

**[P0] Subgenre badges re-violate the One Voice Rule in the table.** `music-table.tsx:~217` renders every subgenre as `<Badge variant="default">` (periwinkle fill), 3–5 per row → ~40 filled accent pills, ~15–20% of the light viewport. DESIGN.md caps periwinkle at ≤10% for wayfinding only. B measures the contrast at **2.5:1 (fails WCAG AA)**. Same disease as the old 30-color Camelot palette, now in the brand color. → subgenres to `variant="secondary"` or `"outline"`; reserve `default` for the active facet chip + current-track row; consider collapsing to "House +3" like `GenresBadge` already does in cards. **`$impeccable quieter src/components/track/music-table.tsx`**

**[P0] Default view is `table`, not `cards`.** `productSearchSchema` defaults `view: 'table'`. The card view is where "The Crate Room" is delivered; the table is what scored 20/40. Every first load / shared link without `?view=` lands on the spreadsheet — the album-art identity is opt-in. → default to `cards`; keep table as the power/edit view; later, persist last-used per user. **`$impeccable shape src/routes/music.tsx`**

**[P1] Two unsynchronized sort UIs.** Half-fixed from baseline. Card view = "Sort" popover; table view = clickable column headers. Same `table` state, two presentations, no cross-view indication. → one control: put `DataTableSortList` in both headers (column clicks as a shortcut into it), or show a removable "Sorted by Tempo ↓" chip in the filter bar for both. **`$impeccable clarify src/components/track/music-view.tsx`**

**[P1] Table has no responsive strategy.** 13 columns, `overflow-x-auto`. Key column clipped at 1440w; unusable at 390w. WCAG 2.1 AA reflow (1.4.10) requires no loss of function at 320px — the table scrolls instead of degrading. → below `md`, force card view (or a compact 2-line row); above `md`, ship a ~6-column default (Art, Title/Artist, BPM, Key, Genre, actions) with the rest behind the column-visibility menu. **`$impeccable adapt src/components/track/music-table.tsx`**

**[P2] Key notation is inconsistent across the product.** Tiles + table show "E minor" (musical names); the wheel + "Mixes with" chips show "8A"/"9A" (Camelot codes). A DJ finds "9A" on the wheel then scans the library seeing "E minor" and has to translate — the exact music-theory-mid-set that Camelot notation exists to prevent. → show both compactly (`9A · E min`) or make it a preference; at minimum lead the Key badge with the Camelot code. **`$impeccable typeset src/components/track/track-feature-options.ts`**

## Persona Red Flags

**Alex (power user):** arrows move the *playing* track, not a selection — can't silently arrow through 775 pages · no multi-select / bulk genre-correct in either view (the `DataTable` `actionBar` slot exists, nothing populates it) despite principle 2 · no "jump to page" (775 pages, prev/next only) · rows-per-page shows max 10 — a crate-digger wants 50–100.

**Sam (accessibility):** `?` button is a low-contrast 24px ghost, shortcut list omits half the real shortcuts · Camelot wheel = 24 sequential tab stops, no roving tabindex, no arrow movement, and `focus-visible:opacity-90` on the SVG path is the *only* focus indicator (10% opacity shift ≠ visible focus, fails 2.4.7) · wheel hues in light mode (`rgba(…, 0.55)` over near-white) may fail 3:1 non-text contrast · `LibraryStatusStrip` progress has `aria-label` but no `aria-live` — no SR scan-progress updates · plus the table subgenre badge 2.5:1 contrast (P0).

**The off-gig set-builder (from PRODUCT.md — "curation, not archaeology"):** incomplete-track surfacing is *only* a scan-in-progress strip. Once the scan finishes there's no way to filter the library to "missing key" / "missing genre" — Tempo/Key cells show "N/A" inline but you can't filter *for* them. The "Analyzing your library" strip vanishes and the rough edges go invisible again — contradicting principle 5's "never hidden."

## Minor Observations

- Header "Last scan completed: 09/01/2026 13:54 in 14 minutes 38 seconds" is cramped against the theme toggle and reads as debug output — a quieter "Scanned 2h ago" would do.
- `capitalize` CSS on titles mangles real formatting ("Feeling Happy (Castelli &…").
- Card grid: no top pagination or count — long scroll to reach the pager on a tall grid.
- `GridSkeleton` renders 12 tiles; `perPage` defaults to 10 — mismatch.
- Harmonic page pulls only `SAMPLE_SIZE = 200` and filters client-side; "70 compatible in the latest 200 scanned" silently ignores ~99.7% of a 775-page library.
- `music_.harmonic.tsx` uses the `music_` route escape — the harmonic view loses the filter bar / view-toggle context, feels like a separate app.
- Favorite heart uses raw `fill-red-500`, not the `destructive` rose token.
- Two `NoData` "no matches" implementations (`music-view.tsx` and `music-card-grid.tsx`) with slightly different copy.
- Card + play-button shadows: 18% opacity is at the DESIGN ceiling and the second shadow layer is a near-crisp offset — borderline vs "The No Hard Edge Rule."

## Questions to Consider

1. If the card view is the product's soul, why does the schema default to the view the last critique scored "Poor"?
2. Does the table need 13 columns, or is it a bulk-edit tool wearing a browse tool's clothes? What if "table" were explicitly "Edit mode" — checkboxes, inline genre correction, no album-art pretense?
3. The Camelot wheel proves the team can render DJ concepts natively. Why does the rest of the app still speak "E minor" instead of "9A"?
4. Principle 5 says rough edges are "never hidden" — where's the persistent "142 tracks need review" entry point once the scan finishes?
5. Keyboard nav plays tracks as you move — feature (audition fast) or bug (can't browse quietly)?

## Verdict vs the 20/40 baseline

**+8 points (20 → 28).** Genuinely fixed: stock data-table gone from the card path (P0 for cards); 30-color Camelot palette gone and re-homed to the wheel (P0); scan status surfaced inline (P1); keyboard map discoverable + focus retained after pagination (P2 partial). Remaining: the **table is still the default and still spreadsheet-shaped** (original P0 relocated, not killed); the **One Voice Rule is re-violated** by filled periwinkle subgenre badges (new P0, same class of error); the **two-sort-UI inconsistency persists** (P1 unchanged); **table reflow** is a new AA gap. One config change (`view: 'cards'`) plus one badge-variant change would credibly reach 32–33.
