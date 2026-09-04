---
target: the DropdownMenu from playlist-card.tsx
total_score: 15
max_score: 36
na_heuristics: 10
p0_count: 1
p1_count: 2
target_identity: "file:/Users/alessandro/dev/cursor-dev/muzo/frontend/src/components/playlist/playlist-card.tsx"
target_fingerprint: "sha256:7b158b414aec202cbdcb59993d01ec0365a1fb7da413104a70d9ccac4271a40e"
target_path: /Users/alessandro/dev/cursor-dev/muzo/frontend/src/components/playlist/playlist-card.tsx
timestamp: 2026-09-04T06-30-27Z
slug: src-components-playlist-playlist-card-tsx
---
# Critique — the `DropdownMenu` in `playlist-card.tsx`

Method: dual-agent (A: design-review · B: detector-evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Disabled rows during export/rescan show no label change, no spinner, no start-toast; `handlePlay` is a silent `console.log` no-op (`playlist-card.tsx:95`) |
| 2 | Match System / Real World | 2 | "Copy files to export folder" / "the server's export folder" is server-centric jargon; "Add to queue" is non-functional |
| 3 | User Control and Freedom | 3 | Confirm dialogs have good escapes; no undo; menu→dialog bug can strand the page |
| 4 | Consistency and Standards | 1 | Fails the app's own menu convention on every count — no icons, `align="start"` vs `"end"`, no header, no groups, no `afterMenuCloses` |
| 5 | Error Prevention | 2 | Confirm dialogs help, but "Force re-scan" and "Delete" are adjacent with no separator; no double-fire guard on export |
| 6 | Recognition Rather Than Recall | 1 | No icons — every row is read, not recognised; no header, so you lose track of which playlist's menu is open |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts; no sub-menu; rare and common actions flat-mixed |
| 8 | Aesthetic and Minimalist Design | 1 | Minimalist by accident — plain-text list on the product's most tactile surface |
| 9 | Error Recovery | 2 | Failure toasts are human, but disabled-state failures aren't surfaced inline |
| 10 | Help and Documentation | n/a | Not a menu-surface concern |
| **Total** | | **15/36** | **Poor (42%)** |

Detector: `detect.mjs` returned `[]`, exit 0, over all three menu files. Failures here are compositional/convention-level, outside the mechanical scan. No false positives.

## Design Specificity Verdict

**Category-interchangeable.** The target menu (`playlist-card.tsx:220–243`) is five naked text rows — no icon, no separator, no header, no grouping, `align="start"`. Every other menu carries Muzo's fingerprints: `track-more-menu.tsx:106–129` opens with a cover-art + title + artist header and three `DropdownMenuGroup`s; `nav-user.tsx` and `library-card.tsx` put a Lucide icon on every row and use `align="end"`. The playlist card is the product's most-repeated action surface and has the least-authored menu.

Structural diff (Assessment B):

| Aspect | playlist-card | playlist-detail-actions | track-more-menu (ref) |
|---|---|---|---|
| Icon on every item | no | yes | yes |
| `DropdownMenuSeparator` | no | yes (2) | yes (4) |
| `DropdownMenuGroup` | no | no | yes (3) + 1 Sub |
| `DropdownMenuLabel` header | no | no | yes |
| `align` | `"start"` | `"end"` | `"end"` |
| `modal` | `false` | unset | `false` |
| Defers dialog open | no | yes | yes |

Visual overlays: none — component files, no dev server, no automation.

## Overall Impression

The confirmation-dialog work in this file is genuinely good. But the menu that triggers those dialogs is the weakest action surface in the app, on the screen that shows the most menus. Biggest opportunity: the two playlist menus have silently diverged (different action sets, architecture, fidelity) and should collapse into one shared component + hook, taking `track-more-menu`'s anatomy as the template.

## What's Working

1. Confirmation dialogs are well-written and on-world (`playlist-card.tsx:296–300`), with correct pending button states.
2. Destructive intent is colour-coded consistently (`text-destructive focus:text-destructive`).
3. Trigger accessibility basics right — real `aria-label` naming the object, icons `aria-hidden`.

## Priority Issues

### [P0] Menu items open Radix dialogs directly — pointer-events lock
`playlist-card.tsx:232` and `:239` open an `AlertDialog` from a menu item while the menu is closing — the `radix-menu-opens-dialog-pointer-lock` failure. Both siblings defer (`playlist-detail-actions.tsx:47`; `track-more-menu.tsx:156`). `modal={false}` mitigates but doesn't reliably prevent `pointer-events:none` stranding the browse grid.
Fix: adopt `afterMenuCloses = (fn) => () => window.setTimeout(fn, 0)` with `onSelect` + `e.preventDefault()`.
Suggested command: `$impeccable harden`

### [P1] Menu is category-generic; fails every app convention
`playlist-card.tsx:220–243`. Rebuild to `track-more-menu`'s anatomy: `DropdownMenuLabel` header with 2×2 cover mosaic (`playlist.stats.images`, fetched at `:152`) + name + track count; `align="end"`; one Lucide icon per row; `DropdownMenuGroup` + `DropdownMenuSeparator` into playback / export / maintenance / delete.
Suggested command: `$impeccable polish`

### [P1] The two playlist menus have diverged — mutualise
Different action sets ("Export as .m3u" card-only; "Download all in HQ" / "Copy tracklist CSV" detail-only), different architecture, different polish.
Fix:
- `usePlaylistActions(playlist)` hook — all mutations, per-action `isPending`, `confirm: 'delete'|'rescan'|'hq'|null` state machine mirroring `ConfirmKind`, `afterMenuCloses` baked in.
- `<PlaylistActionsMenu playlist variant="card"|"detail" />` rendering the superset with groups; `variant` gates only which groups show + trigger size/placement.
- One `<PlaylistActionsDialogs>` sibling driven by the hook.
- Net ~150 lines deleted.
Suggested command: `$impeccable distill`

### [P2] Disabled rows give no status feedback
`playlist-card.tsx:228,233`. Swap label while pending, add `animate-spin` to row icon (as `track-more-menu.tsx:152`), toast on start for long ops.
Suggested command: `$impeccable harden`

### [P2] "Add to queue" is a non-functional stub presented as live
`playlist-card.tsx:95–98,226` — silent `console.log`. Wire to a real queue mutation, or remove the row.
Suggested command: `$impeccable clarify`

## Persona Red Flags

**Alex (Power User):** No keyboard shortcuts. Action set differs between card and detail menus. "Add to queue" doesn't work.

**Sam (Accessibility):** The `…` trigger only mounts on artwork hover (`playlist-card.tsx:179–188`), no focus-triggered reveal — keyboard/SR users likely cannot reach it. No `aria` for disabled reasons. P0 pointer-lock is devastating.

**Riley (Stress-Tester):** rescan mid-close → stranded page. Double-click export → two downloads. "Add to queue" → nothing. Mouse-leave card with menu open → whole interaction unmounts.

## Minor Observations

- `handleEdit` (`:100`) is "view" not "edit" — name lies.
- Export filename regex (`:113`) turns "Sunset Set — Ibiza 2024" into `Sunset_Set___Ibiza_2024`.
- `z-1000` literals (`:210,222`) ignore z-index tokens (`--z-player-overlay`).
- `side="bottom"` (`:223`) pushes menu off-viewport for bottom-row cards.
- `isDownloading` (`:75`) duplicates `downloadPlaylistMutation.isPending`.
- Add `<DropdownMenuSeparator />` before "Delete playlist…".

## Questions to Consider

1. Why does the most-repeated surface get the lowest-fidelity menu?
2. Props-in vs. owns-mutations — which is the intended pattern?
3. Should the export-ish actions be one "Export…" sub-menu?
4. Is the hover-only trigger reveal intentional? How does a keyboard-only DJ cope?
5. Why hasn't `track-more-menu` been the template for both playlist menus already?
