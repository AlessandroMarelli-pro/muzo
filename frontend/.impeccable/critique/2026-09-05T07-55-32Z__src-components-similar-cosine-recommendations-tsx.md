---
target: cosine recommendation page
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:/Users/alessandro/dev/cursor-dev/muzo/frontend/src/components/similar/cosine-recommendations.tsx"
target_fingerprint: "sha256:b72338f23f582414e1def73640d42ce1b5c4154e9a694231237be1032128c619"
target_path: /Users/alessandro/dev/cursor-dev/muzo/frontend/src/components/similar/cosine-recommendations.tsx
timestamp: 2026-09-05T07-55-32Z
slug: src-components-similar-cosine-recommendations-tsx
---
Method: dual-agent (A: a185e28d4697b1eb0 · B: aae335b1cd6921b46)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Skeleton exists, but nothing communicates ranking/match strength once loaded — and "Next random" silently fails with no visible feedback (confirmed live: GraphQL error fires, UI does nothing) |
| 2 | Match Between System & Real World | 2 | DJs think in %/BPM/key; a YouTube-thumbnail grid mid-crate-digging is a metaphor mismatch |
| 3 | User Control and Freedom | 2 | No filters, no dismiss/hide-this-match, no way to correct a bad AI call — directly against "AI proposes, user disposes" |
| 4 | Consistency and Standards | 1 | Two tabs, two incompatible card languages (video grid vs. metadata rows) for identical intent |
| 5 | Error Prevention | 3 | `!track.videoId` guard prevents broken images; solid defensive coding |
| 6 | Recognition Rather Than Recall | 2 | No persistent per-card context for why a match is here |
| 7 | Flexibility and Efficiency of Use | 1 | No keyboard path to the hover-preview; no power-user affordance over first-timers |
| 8 | Aesthetic and Minimalist Design | 2 | Clean in isolation, but every track tested (live, 2 different tracks) showed the empty state — "minimal" here is largely "not populated," not restraint |
| 9 | Error Recovery | 1 | Raw `Failed to load recommendations: {error}` text, no retry; confirmed live GraphQL error on random-track fetch renders the app's generic error boundary on hard reload |
| 10 | Help and Documentation | 2 | "Cosine" is an ML implementation term surfaced directly as UI copy, no tooltip explaining it |
| **Total** | | **18/40** | **Poor** |

## Design Specificity Verdict

**LLM assessment:** This tab could be dropped into any generic "related videos" widget. Nothing — card shape, empty-state copy, or the (absent) score treatment — signals Muzo. It's the only surface in the app that abandons "album art is the hero" for YouTube's visual grammar, and the only recommendation surface that hides the very number the feature is built on (`CosineRecommendedTrack.score` is fetched, typed, and never rendered — `cosine-recommendations.tsx` has no reference to `track.score` anywhere). Verdict: **authored for "a YouTube grid," not for Muzo.**

**Deterministic scan:** `detect.mjs --json` on both `cosine-recommendations.tsx` and `similar.tsx` returned exit code 0, zero findings. The detector's browser-overlay script (`detector/browser/injected/index.mjs`) turned out to be a non-standalone build fragment (references an undefined global `ANTIPATTERNS`) — confirmed by evaluating it live and getting `ReferenceError`. No false positives to report since nothing fired; the clean CLI result is a real signal (no obvious anti-pattern-detector violations like banned-color literals or raw hex), but it does **not** contradict the specificity verdict above — mechanical scans don't catch "this doesn't feel like the product," only pattern violations.

**Visual overlays:** Not available this run — injection script isn't a working standalone artifact (see above), so no `[Human]`-tab overlay exists to point to. Fallback: screenshots + accessibility-tree reads stood in.

## Overall Impression

The Cosine tab is the weakest surface in the app relative to its own ambition. It's the newest feature (per the recent "replace Elasticsearch recommendations with Postgres + pgvector" commit) and it currently: (1) never shows the score it computes, (2) returned zero results for every track tested live, and (3) sits behind a broken "get another track" flow that throws a GraphQL error and can crash the page on a hard reload. The biggest opportunity is straightforward — surface the score, unify the two tabs' visual language, and fix the random-track query — because none of it requires new design language, just finishing what's already half-built.

## What's Working

1. **`!track.videoId` fallback to "No video match"** (`cosine-recommendations.tsx:70-72`) — thoughtful, specific defensive UI most teams skip.
2. **100ms hover-preview delay** (`HOVER_PREVIEW_DELAY_MS`) — a deliberate, tasteful choice that avoids flicker on fast mouse passes.
3. **`capitalizeEveryWord` applied consistently** to title/artist keeps typography calm even against the product's known messy-metadata problem.

## Priority Issues

- **[P0] The cosine score is fetched but never shown.** `CosineRecommendedTrack.score` (`playlist-hooks.ts:600`) is typed and returned by the query but `cosine-recommendations.tsx` never renders it — no percentage, no badge, no ordering signal. This is the entire value proposition of "pgvector cosine similarity," and hiding it breaks the product principle that AI output must be reviewable/scrutinizable ("AI proposes, user disposes"). **Fix:** render a `formatSimilarity`-style badge per card, matching the sibling Recommendations tab's convention. **Suggested command:** `$impeccable harden` (finishing an incomplete feature) or `$impeccable clarify` if scoped to just the missing data display.

- **[P0] Random-track fetch is broken, and it's the load-bearing entry point for this whole page.** Confirmed live: every hard/cold reload of `/similar` throws `_ClientError: Variable "$id" of required type "Base64ID!" was not provided` (from `fetchRandomTrack`, `api-hooks.ts:147`), which renders the app's generic error boundary. Once past that, every "Next random" click on either tab silently fails the same way — the track never changes, no visible feedback. Root cause implicated: `Route` in `similar.{-$trackId}.tsx` falls back to `user?.randomTrackId`, which is unavailable/stale in these paths. **Fix:** guard the query so it doesn't fire without an id, and give `refetch` in `similar.tsx:27-33` a fallback/error path so a failed fetch doesn't silently no-op. **Suggested command:** this is a functional bug rather than a design command, but `$impeccable harden` covers the error-state/edge-case design work needed once fixed.

- **[P1] Two incompatible layouts for one task, in adjacent tabs.** `similar.tsx:107-121` presents a grid-of-video-thumbnails (Cosine) beside a list-of-metadata-rows (Recommendations) for the identical intent of "find a similar track." This doubles the user's mental model cost for zero functional gain, and the video-grid abandons the app's own "album art is the hero" thesis in favor of YouTube's visual grammar. **Fix:** unify on the list-row pattern, falling back to YouTube thumbnail art only when local album art is unavailable. **Suggested command:** `$impeccable layout`.

- **[P1] Error state is a dead end.** `cosine-recommendations.tsx:130-135` shows raw `Failed to load recommendations: {error}` text with no retry action — inconsistent with the page-level `NoData` pattern (icon + title + subtitle + CTA) already established elsewhere in this same file's parent (`similar.tsx`'s empty state). **Fix:** reuse `NoData` with a retry action instead of a bare string. **Suggested command:** `$impeccable clarify`.

- **[P2] No keyboard-operable equivalent of hover-preview.** `handleMouseEnter`/`handleMouseLeave` (`cosine-recommendations.tsx:26-38`) have no `onFocus`/`onBlur` counterpart, so keyboard users get a static thumbnail forever — a real accessibility gap, not just a nice-to-have. **Fix:** mirror the mouse handlers on focus/blur. **Suggested command:** `$impeccable audit` (a11y-focused) or `$impeccable harden`.

- **[P3] Icon-only queue/playlist-add control has no accessible name.** Confirmed via live accessibility-tree read: a button next to "Add to favorites" exposes no name to assistive tech. Separately, "Cosine" as a tab label is raw ML jargon with no tooltip for a non-technical DJ. **Fix:** add an `aria-label`; consider renaming the tab or adding an info affordance. **Suggested command:** `$impeccable clarify`.

## Persona Red Flags

**Alex (Power User)** — judging match quality fast, at speed, between sets: cannot scan "which of these is actually close" — no score, no order signal, forces opening/hovering each card to guess. This tab actively slows the exact workflow it exists for. Also hit the broken "Next random" during testing: clicking it repeatedly produced zero visible change and a silent console error — a power user will assume the button is dead and abandon it.

**Riley (Stress Tester)** — hard-reloading `/similar` or spamming "Next random" reliably reproduces the app's generic full-page error boundary (confirmed 3x across fresh tabs) and a recurring GraphQL error (confirmed 4x on repeated clicks) — exactly the kind of edge Riley probes for, and it breaks on the first try, not after unusual input.

**Sam (Accessibility)** — the hover-preview iframe has zero keyboard path (see P2); the queue/playlist-add icon-only button has no accessible name; the external-link icon anchor (`cosine-recommendations.tsx:94-104`) has only a `title` attribute, not an `aria-label`, so a screen reader announces "View source" with no indication of which track it links to.

## Minor Observations

- `key={`${track.artist}::${track.title}`}` (`cosine-recommendations.tsx:162`) has no stable ID in the type — risks duplicate-key React warnings if two identical title/artist pairs appear.
- Loading skeleton always renders exactly 8 placeholders regardless of the eventual result count, slightly overpromising during load.
- Live testing could not get a single populated Cosine card to render — every track tried (2, via the one working navigation path) showed "No Cosine recommendations found for this track." This may be a seed-data/pgvector-population issue separate from the UI, but it means the UI-as-shipped has not actually been seen in its populated state by either assessment — worth flagging before further design work assumes a populated grid looks the way the source code implies.
- One unrelated Chrome-extension console error observed during testing (`chrome-extension://.../content.js`); not part of the app.

## Questions to Consider

- If pgvector cosine similarity is meant to replace/complement Elasticsearch recommendations, why does its UI regress the app's core "album art is the hero" thesis by pulling in YouTube thumbnails instead of local art?
- Was the `score` field simply forgotten in the UI, or is there a deliberate reason (calibration, noise, not-ready-for-users) it's being withheld — and if the latter, should this tab even ship visible to users yet, given it's also returning empty for every track tested?
- Is "Cosine" ever meant to be the label a non-engineer DJ sees, or is this a placeholder that shipped as-is?
