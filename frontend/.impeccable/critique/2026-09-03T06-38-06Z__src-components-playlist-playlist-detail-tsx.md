---
target: playlist detail header
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/alessandro/dev/cursor-dev/muzo/frontend/src/components/playlist/playlist-detail.tsx"
target_fingerprint: "sha256:44586eef6035916e1c4cf4444ea9806e002dacd5995dbade4bf6b8f6c44e917c"
target_path: /Users/alessandro/dev/cursor-dev/muzo/frontend/src/components/playlist/playlist-detail.tsx
timestamp: 2026-09-03T06-38-06Z
slug: src-components-playlist-playlist-detail-tsx
---
# Critique — Playlist Detail Header ("Cue Sheet" masthead)

Method: dual-agent (A: design review · B: detector + browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Sort trigger never shows the current order — always just "Sort". No track-count near the toolbar. |
| 2 | Match System / Real World | 3 | "Replace queue", "Play from the top" are DJ-native; stamped meta line reads like a real sheet. "Actions" is contentless. |
| 3 | User Control and Freedom | 2 | The Back button is the only "up" affordance on the route — removing it naively leaves zero wayfinding. No breadcrumb. |
| 4 | Consistency and Standards | 2 | Three ghost dropdowns, three icon conventions: "Actions" has no leading icon, "Sync" hard-codes mr-2/ml-2 over base gap-2 (measured 117px vs 92/97px). |
| 5 | Error Prevention | 3 | Delete and Replace-queue both confirm; every control disables on !playlist. |
| 6 | Recognition Rather Than Recall | 2 | Sort order must be recalled. "Actions" must be opened to discover contents. "Add tracks" appears twice. |
| 7 | Flexibility and Efficiency | 3 | Rich power features but no keyboard shortcuts; #1 and #2 actions separated by full toolbar width. |
| 8 | Aesthetic and Minimalist Design | 2 | Four control clusters under one h1; three look identical. mr-auto gap is dead space. |
| 9 | Error Recovery | 3 | Sync auth-retry flow and real error toasts genuinely well done. |
| 10 | Help and Documentation | 2 | Nothing explains "Sync", HQ cost, or "Replace queue" before commit. Meta line unlabeled. |
| **Total** | | **25/40** | **Acceptable — significant improvements needed** |

## Design Specificity Verdict

LLM assessment (2/4): Headline zone is on-concept — bold h1 + mono uppercase stamped meta line + border-b rule is a credible cue-sheet header, respects the mono-for-machine-values rule. Everything below is a default shadcn action bar: justify-end gap-2, primary button shoved left with mr-auto, three near-identical ghost dropdowns. Masthead is "cue sheet"; toolbar is "app chrome"; glued in one border-b block and the seam shows.

Deterministic scan: CLI detector on all three target files — exit 0, clean, zero findings. Live-page overlay found 9 anti-patterns page-wide but only 1 in the header: all-caps-body on the meta line (playlist-detail.tsx:91). This is the deliberate cue-sheet stamp — accepted trade-off — but when description is appended it too gets uppercased and runs into the stats with no break. Other 8 (layout-transition on sidebar/shell, nested-cards in chart, overused-font global) out of scope.

Measured evidence: At 1440px no overflow; row-2 buttons perfectly aligned to each other. Misalignment is Row 1: Back button box t=82 h=32 vs h1 box t=80 h=30 — mt-0.5 is a hand-tuned approximation, Back box hangs ~4px below the h1. The mr-auto gap is content-dependent dead space. At ~390px the action row wraps — "Add tracks" alone on line 1, three ghosts on line 2. Every header button is 32px tall (size="sm") — below the 44px touch-target minimum.

## Overall Impression

A strong 30% idea bolted to a default 70% toolbar. The stamped masthead has character; the control strip beneath has none and doesn't cohere with it. All three user instincts are correct — alignment is off (row 1), the Back button steals the h1's slot and needs a magic nudge, the primary button is under-weighted. Biggest opportunity: empty the toolbar. Move Sort into the tracks tab, collapse "Actions" into a ⋯ overflow, let "Add tracks" own the header.

## What's Working

1. The stamped meta line — font-mono uppercase text-xs [letter-spacing:0.04em], ·-separated, en-dash BPM range. On-concept, on-token, distinctive. Keep as is.
2. Structural bones — space-y-3 + border-b pb-4 cleanly rules the masthead off from content.
3. Sync error/auth handling — ProviderAuthDialog owned outside the Radix menu, retry-after-auth flow, real toast messages. Production-grade.
4. Disabled-state discipline — every control checks !playlist / pending mutation, consistently.

## Priority Issues

### [P1] The mr-auto gap and row-1 misalignment (user concern #1)
Why: mr-auto on the primary button creates an indeterminate content-dependent gap and forces the unpredictable 2-line mobile wrap. Row 1 aligns Back to the h1 via a hand-tuned mt-0.5 that doesn't land — Back box hangs 4px low.
Fix: Kill mr-auto. Action cluster = one right-aligned flex items-center gap-2 group, no auto-margins. Align h1 left = toolbar left = chart/tabs left; toolbar right = content right. Once Back is gone, row 1 is just the h1. Drop the dead const loading = false condition.
Suggested command: $impeccable layout

### [P1] Remove the Back button (user concern #2)
Why: ghost size="sm" ArrowLeft + "Back", items-start, mt-0.5 — occupies the top-left slot that belongs to the h1, makes the page feel like a wizard step, eats ~90px of title width on mobile. Currently the only route-level "up."
Fix: Delete the button. Replace with a mono-uppercase overline link above the h1, styled like the meta stamp — PLAYLISTS or ← PLAYLISTS, font-mono text-xs uppercase [letter-spacing:0.04em] text-muted-foreground hover:text-foreground, wired to onBack (ideally a real Link to="/playlists"). Don't ship zero back affordance.
Suggested command: $impeccable layout

### [P1] "Add tracks" button style (user concern #3)
Why: size="sm" / text-xs — identical in size to the three ghost triggers, distinguished only by fill color. shadow-xs on a filled spot-blue button is nearly invisible on warm stock and contradicts the theme's "flat confident fields." Label duplicated in the Actions menu.
Fix: size="sm" → size="default" (h-9 px-4 text-sm); also fixes 32px→36px touch target. Drop shadow-xs. Keep variant="default" / rounded-md. Label "Add tracks…". Remove the duplicate DropdownMenuItem from playlist-detail-actions.tsx:98-101. Position at the end (right) of the cluster or immediately right of the h1.
Suggested command: $impeccable polish

### [P2] Three indistinguishable ghost dropdowns
Why: "Actions ▾", "Sync ▾", "Sort ▾" are visually identical; inconsistent internals (Sync double icon spacing, Actions missing icon).
Fix: Normalize every trigger to leading icon + label + trailing ChevronDown on base gap-2 (delete Sync's mr-2/ml-2 in playlist-detail-third-parties.tsx:182,184). Convert "Actions" to an icon-only ⋯ overflow. Move "Sort" into the tracks-tab header — it only sorts the tracks list.
Suggested command: $impeccable distill

### [P2] Sort trigger doesn't show current state
Why: Users must open the menu to check whether they're on Manual / Recently added / Oldest.
Fix: "Sort: Recently added ▾" on the trigger, or an adjacent mono caption.
Suggested command: $impeccable clarify

## Persona Red Flags

Alex (power user): Sort state invisible on the trigger — re-opens the menu constantly. "Add tracks" (#1) maximally far from "Sort" (#2) via mr-auto. No keyboard shortcuts. "Actions" reveals nothing — no muscle memory possible.

Casey (mobile): Every header button 32px tall — below 44px. At 390px the row wraps raggedly. Back button eats ~90px of a truncated h1. Meta line's appended description never visible on mobile.

Sam (accessibility): focus-visible:ring-1 — borderline WCAG 2.4.7 on spot blue against warm stock. "Actions" accessible name tells a screen-reader user nothing. Sort's accessible name doesn't reflect selection. h1 truncate with no title attr. (Icons aria-hidden, Radix keyboard-navigable — fine.)

## Minor Observations

- mt-0.5, mt-1, mt-1.5 magic numbers; items-baseline removes them once Back is gone.
- Meta line and description share one <p> — screen reader reads them as one run-on sentence. Split.
- stats?.bpmRange?.min of 0 is falsy, would silently drop the BPM segment (latent).
- PlaylistDetailThirdParties mounts two always-on ProviderAuthDialogs — heavy for a header button.
- Detector's all-caps-body hit is the intentional cue-sheet stamp — accept it, keep the free-text description out of the uppercased run.

## Questions to Consider

- Does "Sort" belong to the playlist or the tracks list? Moving it to the tab header nearly empties the masthead toolbar.
- Is the "cue sheet" concept served by a toolbar at all? One "Add tracks" button + a ⋯ overflow may be more honest to the metaphor.
- The Back button exists because the route has no other "up." Is the real fix a persistent breadcrumb pattern for all detail routes?
- Why does the primary action appear twice? Which one do you want people to use?
