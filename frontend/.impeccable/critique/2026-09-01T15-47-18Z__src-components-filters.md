---
target: filters (drawer vs menu)
total_score: 17
max_score: 36
na_heuristics: 9
p0_count: 2
p1_count: 1
target_identity: "file:/Users/alessandro/dev/cursor-dev/muzo/frontend/src/components/filters"
timestamp: 2026-09-01T15-47-18Z
slug: src-components-filters
---
Method: dual-agent (A: general-purpose design review · B: general-purpose detector/browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Loading spinner buried in drawer title; no live "N tracks match" count anywhere |
| 2 | Match System / Real World | 3 | DJ-legible field names; "Valence" is the one term that needs a plain-language assist |
| 3 | User Control and Freedom | 1 | `onInteractOutside` preventDefault makes the drawer modal-strength for a lightweight task |
| 4 | Consistency and Standards | 1 | Two competing filter UIs for the same data, different copy/iconography conventions |
| 5 | Error Prevention | 3 | Sliders/multi-selects structurally can't produce invalid states |
| 6 | Recognition Rather Than Recall | 2 | Reset sits below 10 fields; no per-section clear |
| 7 | Flexibility and Efficiency | 1 | Modal-blocking drawer is the opposite of the "adjust while browsing" workflow it serves |
| 8 | Aesthetic and Minimalist Design | 2 | 10 fields, flat hierarchy, no progressive disclosure |
| 9 | Error Recovery | n/a | No error states possible in this form |
| 10 | Help and Documentation | 2 | No tooltips on MIR-jargon fields (Instrumentalness, Valence) |
| **Total** | | **17/36** | **47% — Poor to Acceptable band** |

## Design Specificity Verdict

Split personality. `music-filter-bar.tsx` already contains a second, better filter system: `FacetFilter` and `TempoFilter`, inline non-modal Popovers with badge-count trigger buttons, deferred-commit sliders, per-facet Clear rows. Covers Genre, Subgenre, BPM, Key, Energy.

The drawer (`filter-sheet.tsx` + `filter-component.tsx`) sits in the same toolbar as "Filters," duplicating Genre/Subgenre/Key/BPM and adding Mood (Valence, Danceability, Instrumentalness) and Library. Generic Shadcn boilerplate by comparison.

Deterministic scan: `detect.mjs --json src/components/filters` — exit 0, no findings.

Visual overlays: not available — Assessment B hit an auth wall (`/music` redirects to `/login`), no runtime screenshots/measurements captured. Structural findings confirmed from source only.

## Overall Impression

The team already had the "I don't like the drawer" instinct and half-fixed it. FacetFilter/TempoFilter is the answer sitting in the same file as the problem. Biggest opportunity: finish the rollout that already exists.

## What's Working

1. FacetFilter/TempoFilter inline pattern — badge-count triggers, onValueCommit deferred BPM updates, per-facet Clear.
2. Debounced artist/title search (300ms) in the toolbar.
3. State-aware controls — hasActiveFilters gates clear-all X, Reset disabled when inactive.

## Priority Issues

[P0] Two competing filter UIs for the same data, nested in the same toolbar.
Why it matters: direct cause of "I don't like the drawer" — inconsistent muscle memory, doubled maintenance surface.
Fix: extend FacetFilter to Mood fields + Library, retire drawer as primary filter UI.

[P0] onInteractOutside preventDefault makes the drawer modal-strength.
Why it matters: filter-sheet.tsx:24 blocks click-away, forcing sequential open→configure→close→look loop.
Fix: remove outside-click block; moot once fields move to popovers.

[P1] Flat, undifferentiated hierarchy across 10 equal-weight fields.
Why it matters: Genre/BPM/Key reached for constantly, Mood/Library rarely, but equal visual weight.
Fix: resolved by P0 fix.

[P2] No live result count anywhere in the filter UI.
Why it matters: DJs need to know match count before closing the panel.
Fix: surface track-count badge near Filters button.

[P2] Two mismatched clear/reset affordances, inconsistent placeholder copy.
Why it matters: same action, two different treatments/conventions.
Fix: standardize on one reset pattern and one copy convention.

## Persona Red Flags

Alex (Power User): modal block is biggest friction; no keyboard shortcut to open Filters; MultiSelect chip row scrolls past 3 selections.

Sam (Accessibility-Dependent User): multi-select.tsx role="button" span instead of real button (lines 100-114); chip removal onClick-only, no onKeyDown (lines 80-94).

New/Occasional User: 10 fields incl. MIR jargon (Instrumentalness, Valence), zero tooltips, intimidating on first open.

## Minor Observations

- multi-select.tsx:99 — hardcoded `bg-red-300` divider, likely debug leftover.
- filter-sheet.tsx:23 — z-998, odd non-round z-index.
- Sheet width sm:max-w-[500px] generous; inconsistent grid usage (Search is grid-cols-2, rest is 1-col).
- Drawer sliders may not defer-commit like TempoFilter's onValueCommit does — worth checking.

## Questions to Consider

- Why does the drawer still exist on the same screen as the toolbar that already solved this?
- Swipe/Pending pages never got the inline bar — deliberate cut or unrevisited?
- What would Mood/Library look like as truly secondary, collapsed by default?
