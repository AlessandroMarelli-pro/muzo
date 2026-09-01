---
target: playlist component (playlist detail view)
total_score: 15
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:/Users/alessandro/dev/cursor-dev/muzo/frontend/src/components/playlist"
timestamp: 2026-09-01T20-00-16Z
slug: src-components-playlist
---
Method: dual-agent (A: design review · B: detector + technical evidence)

# $impeccable critique — Playlist Detail View

**Target:** `src/components/playlist/playlist-detail.tsx` and its children (actions, sync, chart, tracks list, track row, recommendations, discovery) — the page a DJ works in when curating one playlist. **Mode: Operate.**

**Browser evidence:** the live app froze the renderer 45s+ repeatedly — on `/playlists` after interacting with cards, and on the detail route on load. Two clean list screenshots + the raw error-state DOM were captured; the happy-path detail view could not be inspected interactively. The freeze is itself a P0 finding, corroborated by static analysis.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Renderer freezes 45s+ on load; `loading` hardcoded `false` (playlist-detail.tsx:100) so no skeletons; "Set as Queue" spinner lies (mutateAsync not awaited, :171) |
| 2 | Match System / Real World | 2 | "Set as Queue" silently destroys the existing queue; "Copy List" produces CSV with no forewarning; "Manual (Descending)" sort is nonsensical |
| 3 | User Control and Freedom | 2 | Playlist delete via native confirm(), no undo; track removal has a lovely undo toast — reassurance inverted; silent reorder-revert on error |
| 4 | Consistency and Standards | 2 | 4 dropdown menus, 3 trigger patterns; `✓` text spans not aria-checked; native confirm/alert + toast + Radix dialogs coexist |
| 5 | Error Prevention | 1 | No guard on queue-wipe; native confirm for delete; stale/deleted playlist dumps raw GraphQL JSON (no errorComponent anywhere) |
| 6 | Recognition Rather Than Recall | 2 | 4 unlabeled icon buttons per track row; sort state hidden in closed menu; Brain = "research" unguessable |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts, no multi-select, no bulk remove, no BPM/key/energy sort; chart inert; keyboard drag-reorder broken (sortableKeyboardCoordinates missing) |
| 8 | Aesthetic and Minimalist Design | 2 | Header crams Back + title + 3 badges + 3 dropdowns on one justify-between row → title truncates; <h1> is text-base (14px); hardcoded trailing `:` |
| 9 | Error Recovery | 0 | Error state IS error.message = a JSON blob with "Hide Error" toggle, no recovery action; every OAuth failure is a native alert() |
| 10 | Help and Documentation | 1 | No explanation of Recommendations vs Discovery, "Download All in HQ" cost, or chart y-axis (rescaled (tempo − minTempo)/10, unlabeled) |
| **Total** | | **15/40** | **Poor — core experience is broken** |

The freeze (H1) and the raw-error dump (H9) are individually disqualifying for an Operate surface.

## Design Specificity Verdict

**Category-interchangeable CRUD detail page with a thin coat of Muzo paint.**

**LLM assessment.** DESIGN.md's north star: "The Crate Room — album art forward, cards frame the artwork." This page contradicts nearly every clause:
- No album art above the fold. Hero is a 14px text <h1>. Only art is a 40×40px thumbnail per row — smaller than the genre badges beside it.
- The track list is a Card wrapping a divide-y table — the spreadsheet-cold pattern the system exists to avoid — at p-2 gap-2 density.
- "AI proposes, user disposes" is buried: Recommendations + Discovery are tabs 2/3, visually identical to "Tracks", while "Sync to Spotify" is a top-level toolbar button.
- The periwinkle "One Voice" wayfinding accent is absent from the header — every control is variant="ghost", no primary action, no "you are here."
- Iconography is decorative misfire: HeartPlus for BPM range, Disc3 for track count, ChevronDown as a leading icon on "Actions".

On-brand: Roboto Mono for BPM/duration, genre/subgenre badges, the chart's periwinkle ramp, and the now-playing row treatment (periwinkle left border + muted bg, correct first/last rounding). That's the whole list.

**Deterministic scan.** detect.mjs on 7 files: 1 rule, 2 occurrences, 1 file — `side-tab` at playlist-track-list-card.tsx:76 and :79. Partial false positive: those border-l-2 border-l-primary lines are the functional now-playing indicator, not decorative chrome — but it IS color-only status (no text/icon marker), so it converts to an a11y finding. Detector otherwise clean; the real problems are behavioral and structural.

**Visual overlays.** Not available — renderer froze before injection could run in the detail view. Fallback: static analysis + 2 list screenshots + captured error-state DOM.

## Overall Impression

The bones of several flows are thoughtful — the undo toast, optimistic drag-reorder with revert, the OAuth-dialog state-ownership fix, the HQ batch-download dialog. But the page as a whole has inverted its own product: the crate-room tool has no crate, the AI's proposals are hidden behind tabs, and the surface locks the browser on load. Biggest opportunity: fix the freeze, then rebuild around album art and the AI's suggestions instead of a toolbar and a table.

## What's Working

1. Track-removal undo toast (playlist-tracks-list.tsx:79–88) — real Undo that re-adds the exact track, name via capitalizeEveryWord.
2. Optimistic drag-reorder with revert (playlist-tracks-list.tsx:104–128) — instant local update, positions recomputed for both directions, rollback on failure, tracksSignature memo to resync after server sort.
3. HQ batch-download dialog (playlist-hq-batch-download-dialog.tsx) — per-track status icons, live SSE progress, localStorage-persisted batch id so a reopened dialog rejoins an in-flight job, honest copy. (Nit: text-green-500 at line 32 is off-palette.)
4. Now-playing row treatment (playlist-track-list-card.tsx:73–84) — on-brand periwinkle "you are here", correct first/last rounding.

## Priority Issues

### [P0] The detail route freezes the renderer 45s+ on load and after interaction
**Why it matters:** An Operate surface that locks the browser is unusable. Both assessments landed here independently; browser session confirmed a pure main-thread CPU block, no console errors (synchronous render work, not an error loop).
**Root cause:** recharts AreaChart re-rendering with a fresh unmemoized data array on every PlaylistDetail render, compounded by O(n²):
- playlist-detail-chart.tsx:16 builds a new array of new objects every render → <PlaylistChart> (no React.memo).
- playlist-chart.tsx:41–48 runs data.slice(0,index).reduce(...) inside .map — O(n²), every render, no useMemo. (Math.min(...data.map(...)) at :40 is a latent RangeError for huge playlists.)
- PlaylistDetail re-renders on every tab change, mutation isPending flip, useQueue() ref change, and router.invalidate() (via non-memoized refetch after every add/remove/sort/queue op, playlist-detail.tsx:116).
- Amplifier: playlist-tracks-list.tsx:198 passes dragHandleProps={{...attributes, ...listeners}} — fresh object — into the memo()-wrapped PlaylistTrackListCard, defeating memo for every row; each row re-runs useCurrentTrack/useIsPlaying/useAudioPlayerActions/useAddTrackToQueue.
**Fix:** React.memo PlaylistChart; useMemo the data transforms keyed on the track list; single O(n) cumulative-duration pass; useCallback refetch/addTrackToPlaylist/inline closures; stabilize dragHandleProps per row or split the audio context so only the active row subscribes to isPlaying; verify with the Profiler.
**Suggested command:** $impeccable optimize

### [P0] Raw GraphQL error object dumped to the end user
**Why it matters:** A stale/deleted playlist link renders `Something went wrong! / Hide Error / Playlist with ID Playlist:bdd… not found: {"response":{"data":{"node":null},"errors":[{…}]}}`. Unrecoverable (no "back to playlists"), a security smell, terrifying to a non-technical DJ. Confirmed: no errorComponent/notFoundComponent anywhere (__root.tsx:177, playlists.$playlistId.tsx:29); fetchPlaylist (playlist-hooks.ts:348) returns data.node with no null guard, so Graffle's thrown error hits TanStack Router's default error component.
**Fix:** Shared errorComponent on __root.tsx + specific one on playlists.$playlistId.tsx (plain sentence, "Back to playlists" Link, raw error to console only). Loader throws typed notFound() for the null-node case + notFoundComponent. Style the bare <div>Error: No playlist ID provided</div> at :15.
**Suggested command:** $impeccable harden

### [P1] "Set as Queue" silently destroys the existing queue with no warning
**Why it matters:** A DJ prepping tonight's set may have hand-built the queue. One click in a 6-item menu loops removeTrackFromQueue over every item (playlist-detail.tsx:160–166) — no confirm, no undo, label doesn't say "replace". The addTracksToQueue.mutateAsync after (:171) isn't awaited/caught — unhandled rejection + empty queue on failure.
**Fix:** Rename to "Replace queue with this playlist." If currentQueue.length > 0, AlertDialog: "This clears your current queue (N tracks). [Replace] [Add to end instead] [Cancel]." Await the add, surface failures.
**Suggested command:** $impeccable harden

### [P1] Native confirm() / alert() is the entire error-feedback strategy
**Why it matters:** Unstyled browser modals shatter the soft rounded world, can't be themed for dark mode (the primary working env per DESIGN.md), block the main thread, aren't testable. Counted: 3 × confirm() (playlist-detail.tsx:137, playlist-card.tsx:66 & :128) and 14 × alert() — 10 in playlist-detail-third-parties.tsx (77, 91, 99, 104, 108, 137, 154, 165, 170, 174) where alert() IS the only OAuth feedback. Six mutation catch blocks (playlist-detail.tsx:133, 149, 179, 197; playlist-tracks-list.tsx:90, 125) swallow errors with console.error only.
**Fix:** confirm() → AlertDialog (destructive variant, playlist name bold, "This can't be undone"). Every alert() → toast.error/success + inline dialog error text. Every swallowed catch → user-visible toast.error.
**Suggested command:** $impeccable clarify

### [P2] Header IA collapses on a laptop; the chart eats the space album art should own
**Why it matters:** Back + <h1 flex-1> + 3 stat badges + 3 dropdown triggers on one justify-between row (playlist-detail.tsx:209) — the title truncates first, losing the one piece of orientation to toolbar chrome. The tempo chart occupies 30vh above the fold with an unlabeled y-axis ((tempo − minTempo)/10), a string x-axis, no interactivity — for set-prep, where the tempo arc IS the mix, this should be the most useful object on screen.
**Fix:** Two header rows. Row 1: Back + <h1 text-2xl font-bold> + description in muted + one primary "Add tracks" button. Row 2: stat badges left, consolidated toolbar right; move Sort into the Tracks tab header. Lead the page with album art. Make the chart earn its space (real BPM axis, click-to-scroll-to-position, key markers) or shrink it.
**Suggested command:** $impeccable layout

### [P2] Track rows and menus fail keyboard and screen-reader users
**Why it matters:** Verified statically:
- Icon-only buttons with no accessible name: play + delete on every row (playlist-track-list-card.tsx:135, 153). (Research button is done right.)
- Keyboard drag-reorder non-functional: KeyboardSensor registered without coordinateGetter: sortableKeyboardCoordinates (playlist-tracks-list.tsx:59); drag handle spreads listeners onto a bare <svg> with no tabIndex/role (playlist-track-list-card.tsx:88).
- Menu semantics: "Sort by" is a <div> not DropdownMenuLabel; separator is a <div className="h-px"> not DropdownMenuSeparator; active-sort ✓ is a bare glyph, not role="menuitemradio" + aria-checked (playlist-detail.tsx:248, 269, 256).
- Color-only status: now-playing conveyed solely by border-l-primary (the detector's side-tab hit).
- Non-descriptive alt="Album Art" repeated on every image.
**Fix:** aria-label on every icon button; DropdownMenuLabel/Separator/CheckboxItem for sort; add sortableKeyboardCoordinates + a focusable role="button" drag handle; visible now-playing marker (equalizer icon or "Now playing" text); alt="" on decorative row art.
**Suggested command:** $impeccable audit

## Persona Red Flags

**Alex (power user, 200-track playlists):**
- No multi-select, no bulk remove, no bulk "add all recommendations". Every edit is one drag/click.
- Reorder is manual drag only — no "move to top", no numeric position entry, no range cut/paste.
- No keyboard anything. Only sorts: manual-asc/desc, added-date-asc/desc — no BPM, key, or energy sort.
- The freeze makes a 200-row playlist a non-starter.

**Sam (accessibility):**
- Hears "button button button" for the three primary row actions.
- Cannot reorder tracks with a keyboard at all.
- Selected sort option is a bare ✓ with no aria-checked; "Sort by" label is an orphan text node.
- Error state is unstructured JSON with a "Hide Error" toggle, no heading.
- <h1> at 14px is a heading-hierarchy lie.
- Genre/subgenre metadata is hidden below md (playlist-track-list-card.tsx:119) with no alternative.

**The off-gig DJ prepping tonight's set (Muzo-specific):**
- Opens the playlist at home in a dark room; native confirm/alert modals blast unstyled white.
- Wants to audition the set's shape; the tempo chart should show it but is unlabeled and unclickable.
- Builds a queue for the night, clicks "Set as Queue" on a reference playlist — loses the queue they just built.
- Wants "Download All in HQ" before leaving — the menu item gives no hint of cost/time before opening.
- Wants album art to dig by sight — it's 40px.

## Minor Observations

- PlaylistTitle hardcodes `:` after name AND description (playlist-detail.tsx:89–92) — dangling colon with no description.
- const loading = false (playlist-detail.tsx:100) → all child skeleton code is dead; no route pendingComponent either.
- (playlist as any)?.sorting?.sortingKey (playlist-detail.tsx:202–204) — sorting IS in GET_PLAYLIST (playlist-hooks.ts:296); cast is unnecessary and hides a real type.
- formattedImage = imagePath || 'Unknown Image' then ?imagePath=Unknown Image unencoded (playlist-track-list-card.tsx:55, 100) — broken request with a literal space for every track missing art; playlists.index.tsx:14 encodes, this doesn't.
- .toLowerCase() + CSS capitalize for display names (playlist-track-list-card.tsx:108) mangles acronyms, will.i.am, non-Latin scripts.
- mfTempo shown raw (126.4 BPM) in the row but rounded in the chart; || 'Unknown' puts "Unknown BPM" in a numeric column and swallows a legit 0.
- Skeleton count mismatch: list renders 5 skeleton rows; PlaylistMetadata renders 4 skeletons for 3 badges.
- playlist-chart.tsx:64–75 declares 4 gradients; only fillTempo is used — dead SVG.
- Research <Link to="/research/{-$trackId}"> has literal braces in the string (playlist-track-list-card.tsx:163).
- add-track-drawer.tsx:49 uses sm:max-w-[${divMaxWidth}px] — runtime-interpolated Tailwind class the JIT can't see; width change does nothing.
- text-green-500 (playlist-hq-batch-download-dialog.tsx:32) is off-palette.
- On /playlists, PlaylistCard is rendered without onCardClick — card body isn't clickable, only the hover "Eye" button navigates.

## Questions to Consider

1. If Muzo's thesis is "AI proposes, user disposes," why are the proposals two clicks away behind identical tabs while "Sync to Spotify" is a top-level toolbar button?
2. The tempo chart eats 30vh above the fold — if you deleted it tomorrow, would one user complain? If not, why is it the second thing on the page instead of album art?
3. A DJ's playlist view with no cover art larger than a genre badge — is this a crate room, or a Jira backlog with a waveform?
4. "Manual (Descending)" sort — what does it mean to descend a hand-ordered list? Should sort offer BPM / key / energy instead?
5. Delete gets a browser confirm(); removing one track gets a beautiful undo toast. Which action is more destructive, and why is the reassurance inverted?
