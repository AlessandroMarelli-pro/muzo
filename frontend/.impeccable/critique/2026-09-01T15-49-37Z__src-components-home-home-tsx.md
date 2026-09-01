---
target: home page
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/Users/alessandro/dev/cursor-dev/muzo/frontend/src/components/home/home.tsx"
target_fingerprint: "sha256:57ccff55977d9f8a0bf6833fdf77bedf78c566cb5fc53777f0a3916b738bc44a"
target_path: /Users/alessandro/dev/cursor-dev/muzo/frontend/src/components/home/home.tsx
timestamp: 2026-09-01T15-49-37Z
slug: src-components-home-home-tsx
---
Method: dual-agent (A: design-review · B: detector+evidence) · browser inspection unavailable — `/` redirects to `/login` and no credentials are available.

# Re-critique: Home page (`src/components/home/home.tsx`, route `/`)

This is a follow-up to the 2026-09-01T14:46 run (18/40) after a full rebuild across all six recommended commands. **Note:** Assessment A surfaced one real P0 during this run (the "Need analysis"/"Failed" tiles and the primary CTA linked to `/pending`, which is the unrelated rating-triage queue, not an analysis-status view). I verified this against `pending-page.tsx`, `usePendingTracks`, `track-list.tsx`'s `review` mode, and `library-card.tsx`, confirmed it was a real bug in the just-shipped code, and fixed it before writing this report — the scores and issues below reflect the page **after** that fix, with the finding kept visible since it's exactly the kind of mistake this critique exists to catch.

Mode: **Operate**.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Real skeletons, real errors, live scan-progress swap. No global spinner masking section-level state. |
| 2 | Match System / Real World | 3 | DJ-native copy ("all analyzed and ready", "Dig in whenever you're ready"); the one mismatch (tiles pointing at the wrong page) is now fixed. |
| 3 | User Control and Freedom | 3 | Retry per section; briefing and tiles are all standard navigation, nothing traps the user. |
| 4 | Consistency and Standards | 3 | Matches `music-view.tsx`'s `PageHeader`/`NoData`/error-card conventions closely. |
| 5 | Error Prevention | 3 | `playlistsQuery` errors now surface instead of silently reading as "0 in progress" (fixed this run). |
| 6 | Recognition Rather Than Recall | 3 | Tiles are labeled links; genre chips self-explanatory; "Failed" now gets a destructive-red number instead of looking identical to "Analyzed". |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts; still a single fixed layout for every visit — acceptable for a landing page, not exceptional. |
| 8 | Aesthetic and Minimalist Design | 3 | Lean, no clutter, album art still leads the recently-played rail; periwinkle stays to one CTA + one emphasis ring. |
| 9 | Error Recovery | 3 | Section-level `SectionError` + retry, consistent everywhere including the newly-covered playlists path. |
| 10 | Help and Documentation | 2 | The "in progress playlist" pick now shows *when* it was last edited (fixed this run), but the 14-day/30-track rule itself is still nowhere explained if a user wonders why a specific playlist was chosen over another. |
| **Total** | | **28/40** | **Good — solid foundation, address the remaining flexibility/documentation gaps** |

(Previous run: 18/40 — Poor. This run: 28/40 — Good.)

## Design Specificity Verdict

**LLM assessment: mostly authored, no longer category-interchangeable** — with one caveat now closed. The composition reasons over Muzo's actual pipeline state: a `BriefingBlock` that prioritizes unfinished intake → an in-progress playlist → recent adds → "caught up", pipeline tiles keyed to `Library.analyzedTracks/pendingTracks/failedTracks`, a scan-aware swap that avoids showing a stale CTA mid-scan, and DJ-native copy throughout. This is materially different from the original generic "stat cards + list" dashboard and from a template any SaaS could reuse unchanged.

The caveat: Assessment A traced the "Need analysis"/"Failed" tiles and the briefing's primary CTA to `/pending`, and — verified against the backend query (`me.pendingTracks` / `GetPendingTracksUseCase`, filtered by `isLiked`/`isBanger`) and the page itself (`"Nothing left to rate"`) — confirmed `/pending` is the **rating-triage queue**, unrelated to `Library.pendingTracks`/`failedTracks` (analysis pipeline counts). `/music?review=true` resolves to the same rating query, so **no existing route filters tracks by analysis status** — the only place that shows real per-library analysis progress and a "retry incomplete" action is `/libraries` (`library-card.tsx`). This is now fixed: both tiles and the CTA point to `/libraries`, with a code comment explaining why `/pending` was wrong. This is worth naming plainly: it was a real defect in the previous turn's shipped work, caught by the review process working as intended, not a pre-existing issue.

**Deterministic scan:** Both `detect.mjs` runs (file and directory) returned `[]`, exit 0 — **clean**, confirming the detector's blind spot is unchanged: it cannot catch a link pointing at the wrong route, only design-judgment review and cross-file verification can.

Manual notes from Assessment B, now addressed: the `.slice(0, 12)` genre cap was promoted to a named `MAX_GENRES_DISPLAYED` constant (matching the file's own convention of naming `IN_PROGRESS_MAX_AGE_DAYS`/`IN_PROGRESS_MAX_TRACKS`/`RECENT_WINDOW_DAYS`). The inline numeric values in the briefing prose (`addedRecently`, `needsAnalysis`, playlist `count`) are deliberately left out of `font-mono` — they read as prose numbers embedded in a sentence, not standalone stat readouts, which is a defensible distinction from the tile/genre-chip numbers that do use mono.

**Visual overlays:** still unavailable — `/` redirects to `/login`, no credentials to proceed past it. Fallback signal: source review, cross-file route verification, clean CLI detector, passing `tsc`/`oxlint`/`vite build`.

## Overall Impression

This moved from a generic vanity dashboard to a page that reasons over the product's own data — the briefing's priority chain (unfinished intake > resume a playlist > recent adds > caught up) is real product thinking, not a template. The one thing that would have undermined it — a confidently-worded, prominently-ringed CTA pointing at the wrong screen — was caught in this review and fixed. What's left is polish: making the "in progress" heuristic fully legible, and giving the page some accelerators for the daily-driver persona it's built for.

## What's Working

1. **The briefing's priority chain is genuine reasoning over three independent signals**, not a generic banner, with correct singular/plural handling at every branch including the "1 track" edge case.
2. **Scan-awareness**: swapping the briefing for live progress while a scan is running (instead of a stale "start analysis" CTA underneath it) is a correctness call most dashboards miss.
3. **Section-level error isolation**: every query — including playlists, after this run's fix — has its own retry path; one slow or broken call never takes down the rest of the page.

## Priority Issues

### [P1] The "in progress" playlist heuristic is still unexplained beyond the new timestamp
**Why it matters:** The briefing now says "edited 2 days ago," which helps, but if two playlists both qualify (touched in the last 14 days, 1–30 tracks), the DJ still can't tell that a rule chose between them, or see the runner-up. The "Playlists in progress" tile shows a count but links to unfiltered `/playlists`, so the count and the single surfaced pick are never reconciled in the UI.
**Fix:** Either link the tile to a `/playlists` view pre-filtered/sorted to the same in-progress set, or add a one-line "+2 more in progress" under the CTA when `inProgress.count > 1`.
**Suggested command:** `$impeccable clarify`

### [P2] No keyboard accelerators for the daily-driver persona this page targets
**Why it matters:** The brief explicitly chose "returning daily-driver DJ" as the audience, but there's no shortcut to jump straight to the briefing's action, and the pipeline tiles/genre chips are mouse-only despite being simple links. A power user opening Muzo every session gets no faster path than a first-timer would.
**Fix:** Not urgent for a landing page, but worth a future pass — e.g. a single global shortcut that focuses the briefing's primary CTA, consistent with `KeyboardShortcutsHelp` already used on `/music`.
**Suggested command:** `$impeccable optimize`

### [P3] `IN_PROGRESS_MAX_AGE_DAYS` / `IN_PROGRESS_MAX_TRACKS` are invisible product decisions baked into a UI file
**Why it matters:** 14 days and 30 tracks are reasonable defaults, but they're arbitrary until validated against real usage, and nothing surfaces them to the user or makes them configurable. Low severity since the new "edited N days ago" copy gives the user enough signal to sanity-check the pick themselves.
**Fix:** No action needed now; revisit once there's usage data on how DJs actually build playlists.
**Suggested command:** `$impeccable critique` (re-check after real usage data exists)

## Persona Red Flags

**Alex (power user, daily driver):** The one-sentence briefing and scan-aware swap are exactly what she wants on open. The `/pending` mismatch that would have broken her very first click is now fixed — clicking "Need analysis" or the "Failed" tile correctly lands on `/libraries`, where the real counts and a "retry incomplete" action live. Remaining gap: no keyboard path to the primary action (P2).

**Jordan (first-timer):** Still well served — the empty-library branch stays clean and shows none of the pipeline noise that wouldn't apply yet.

**Marco (prepping a set):** The "in progress playlist" surfacing is the right instinct, and now shows *when* it was last touched, which helps him sanity-check the pick. He still can't see the other 1–2 playlists the same rule would have flagged (P1) if the one shown isn't the one he meant.

## Minor Observations

- `SectionHeading` (`text-2xl font-semibold`) matches DESIGN.md's Headline spec exactly.
- Every section has a real heading (visible `SectionHeading` or `sr-only`) and `aria-labelledby`; `PageHeader`'s `sr-only` `<h1>` gives the page a single real document-outline heading ("Home") — the original P0 finding from the first run stays fixed.
- Genre formatting (`formatGenre`) now handles hyphenated/ampersand tags ("D&B", "2-Step", "R&B") correctly rather than only whitespace-separated acronyms — closes a real taxonomy gap for a DJ audience.
- Periwinkle usage counted: one primary CTA button + one `ring-primary/30` emphasis ring on a single tile. Comfortably under the ≤10% One Voice guidance.
- `Array.from({ length: 8 })` (genre skeleton) vs `MAX_GENRES_DISPLAYED = 12` (real content cap) is an intentional mismatch for skeleton compactness, not a bug — noted by Assessment B, judged acceptable.

## Questions to Consider

1. Now that the tiles point at `/libraries` instead of a nonexistent analysis-status filter, is a dedicated track-level "needs analysis" / "failed analysis" view on the roadmap — and if so, should the tiles be built to point at it now so the destination doesn't need re-plumbing later?
2. The in-progress-playlist heuristic (14 days, 30 tracks) is a guess dressed as a feature. Is there any usage data yet on how long a DJ's typical prep session/playlist-build cycle runs, that could replace the guess with a measured threshold?
3. Given the page now scores "Good" on craft and correctness, is the next investment more product signal (recommendations, similarity-based "tracks like what's in this playlist") or interaction polish (keyboard shortcuts, animation) for this specific returning-user audience?
