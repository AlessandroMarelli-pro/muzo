---
target: queue component
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:/Users/alessandro/dev/cursor-dev/muzo/frontend/src/components/queue/queue-sidebar.tsx"
target_fingerprint: "sha256:5afff045e87eb8a0fb329e5c6012c6e7fa9d4c77086cdb176ec25289aef81ab6"
target_path: /Users/alessandro/dev/cursor-dev/muzo/frontend/src/components/queue/queue-sidebar.tsx
timestamp: 2026-09-01T16-16-11Z
slug: src-components-queue-queue-sidebar-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No loading indicator on remove beyond opacity dip; no drag-in-progress cue |
| 2 | Match System / Real World | 2 | No "Playing from / Next from" context |
| 3 | User Control and Freedom | 1 | `onInteractOutside` blocks click-outside dismiss; no undo on remove/clear |
| 4 | Consistency and Standards | 3 | Shared primitives consistent; row density diverges from system's card language |
| 5 | Error Prevention | 1 | Clear-queue and remove both fire immediately, zero confirmation |
| 6 | Recognition Rather Than Recall | 2 | Drag handle invisible until hover |
| 7 | Flexibility and Efficiency | 2 | KeyboardSensor wired but no visible affordance; no batch actions |
| 8 | Aesthetic and Minimalist Design | 2 | Plain/dense, reads unfinished rather than restrained |
| 9 | Error Recovery | 2 | Reorder failure reverts silently, console.error only |
| 10 | Help and Documentation | 2 | Intent documented only for screen readers |
| **Total** | | **19/40** | **Poor** |

## Design Specificity Verdict

**LLM assessment**: Stock shadcn Card + divide-y list wrapped in a Sheet — could belong to any admin panel. No album-art-as-hero, no rounded-xl row language, "now playing" cue is a thin left border plus tint. Functionally sound, visually anonymous.

**Deterministic scan**: detect.mjs flagged 2 side-tab warnings (queue-item-card.tsx:66, 69). Partial false positive (conditional on isCurrentTrack, not static decoration) but reveals a real issue: one hard border carries the entire now-playing signal.

**Visual overlays**: Not available — populated queue content requires a live backend/library not present in this environment. Dev server boot verified clean (HTTP 200).

## Overall Impression

The queue works — optimistic drag reorder with rollback is solid — but nothing feels authored for a DJ prepping a set. Biggest opportunity: a now-playing/up-next structure plus guardrails on the two destructive actions that currently have none.

## What's Working

- Optimistic reorder with rollback (queue-list.tsx:62-86)
- Stable numeric column anchoring position during reorder (queue-item-card.tsx:78-86)
- Sheet primitive clean, 0 detector findings

## Priority Issues

**[P0] Broken image on missing artwork** — `formattedImage = queueItem.track.imagePath || 'Unknown Image'` (queue-item-card.tsx:44) hits the API with a literal sentinel string, guaranteeing a broken image for any track without artwork. Fix: render a placeholder component instead. → $impeccable harden

**[P0] No confirmation or undo on destructive actions** — handleResetQueue (queue-sidebar.tsx:24-26) and onRemove (queue-item-card.tsx:139) fire immediately, no recovery path. Fix: AlertDialog confirm for clear-queue, toast-with-undo for remove. → $impeccable harden

**[P1] Drag handle discoverable only on desktop hover** — opacity-0 group-hover:opacity-100 (line 82) + dragHandleProps?: any (line 20) means touch/keyboard users get no cue reordering exists. Fix: default reduced-opacity handle, full on hover/focus-visible; type properly. → $impeccable audit, then $impeccable polish

**[P1] No now-playing/up-next structure** — one flat border is the only current-track signal; no section split like the reference. Fix: add Now Playing/Up Next split, reinforce with an equalizer glyph. → $impeccable bolder, then $impeccable layout

**[P2] Duplicate-looking row when title missing** — title falls back to artist (line 105) while subtitle also renders artist (line 113), showing the same text twice. Fix: distinct "Untitled Track" placeholder. → $impeccable clarify

## Persona Red Flags

**Alex (Power User)**: No batch operations, no "clear played tracks," no visible keyboard-shortcut affordance despite KeyboardSensor being wired.

**Sam (Accessibility-Dependent)**: dragHandleProps?: any risks ARIA attributes not landing correctly; hover-only opacity trigger excludes :focus, so keyboard users get no visual confirmation of focus on a draggable row.

**Casey (Mobile/Touch)**: TouchSensor configured but handle is hover-only, never discoverable on touch — contradicts the reference's touch-first interaction model.

## Minor Observations

- `alt="Album Art"` identical on every image, no per-track differentiation
- `capitalize` forced on title/artist will mangle correctly-cased names
- Reorder-failure feedback is console.error only, no user-facing toast
- Row density (p-2, 32px art) sits below DESIGN.md's card rhythm, reads cramped with 4 icon-only actions per row

## Questions to Consider

- Is the current density actually serving the DJ, or is this the shadcn default nobody revisited?
- Is the queue answering what a DJ asks mid-prep ("what's coming up and why"), or just listing IDs in order?
- Were KeyboardSensor/TouchSensor ever verified end-to-end, or did the sensors get added without visual affordances catching up?
