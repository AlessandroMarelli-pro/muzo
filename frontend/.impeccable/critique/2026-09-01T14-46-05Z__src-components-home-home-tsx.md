---
target: home page
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:/Users/alessandro/dev/cursor-dev/muzo/frontend/src/components/home/home.tsx"
target_fingerprint: "sha256:97b1f65f14a733cf43a1517cd47c5fe6cdbfe636254ef88d55993f0fb4b316b3"
target_path: /Users/alessandro/dev/cursor-dev/muzo/frontend/src/components/home/home.tsx
timestamp: 2026-09-01T14-46-05Z
slug: src-components-home-home-tsx
---
Method: dual-agent (A: design-review · B: detector+evidence) · browser inspection unavailable (dev server needs backend auth; not started)

# Critique: Home page (`src/components/home/home.tsx`, route `/`)

Mode: **Operate** — the visitor opens this to orient and start a curation session.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | `isLoading = false` hardcoded (line 166) — every skeleton is dead code; the route loader blocks navigation, so clicking "Home" freezes the previous screen with no spinner/skeleton until data resolves. No "last scan" / "analysis running" status anywhere. |
| 2 | Match System / Real World | 1 | "Overview", "Plays", "Played Time" are consumer-listening language (Spotify Wrapped). A DJ's model is crates, sets, "ready to play", "needs tagging" — none present. |
| 3 | User Control and Freedom | 2 | Little to get wrong, but nothing to undo/dismiss; CountUp can't be skipped; no way to reorder/hide stats that don't matter. |
| 4 | Consistency and Standards | 2 | `CardDescription` nested inside `CardTitle`; badge `size="sm"` + `p-3` + `h-6` fight each other; sibling routes (`music-view.tsx`) use `PageHeader` with a real h1 + description, home uses neither. |
| 5 | Error Prevention | 3 | Low-risk read-only page; main gap is no first-run state, so a new user hits a wall of zeros. |
| 6 | Recognition Rather Than Recall | 2 | Stat cards are number-over-label, no icon, no trend, no context — you must recall what "24" meant last visit. Genre name buried in `<strong>genre:</strong> count` micro-text. |
| 7 | Flexibility and Efficiency | 1 | Daily users get the same count-up animation on every fresh load, the same non-actionable stat wall, no "resume where you left off", no shortcuts to in-progress work. |
| 8 | Aesthetic and Minimalist Design | 2 | Five stat cards each with a `from-primary/5` periwinkle wash — accent far exceeds the ≤10% One Voice rule and is decorative, not wayfinding. `justify-between` on a flex-wrap badge row = erratic gaps. ~35 lines of dead `ChartRadar` code. |
| 9 | Error Recovery | 2 | Loader `Promise.all` means one failed query blocks the whole route; no route-level error UI referenced. |
| 10 | Help and Documentation | 2 | Empty-state microcopy exists for genres and recently-played, but it gives *wrong advice* ("play some tracks" when genres come from analysis), and there's no onboarding for a fresh library. |
| **Total** | | **18/40** | **Poor — major UX rework required** |

## Design Specificity Verdict

**LLM assessment: category-interchangeable (generic SaaS dashboard).** Strip the three button labels and the word "genre" and this is a template dashboard that fits a CRM, an analytics tool, or a fitness app equally well:

- **Stock skeleton.** `hero buttons → "Overview" stat row → "Top Genres" → "Recently Played"` is the canonical "stat cards + list" pattern. "Overview" is the most generic section header in software.
- **Album art is not the hero.** DESIGN.md's north star is "album art forward; cards frame it, don't compete." Here, album art appears only in one horizontal rail at the very bottom — below the fold after the 5-card stat grid. The visual weight up top is numbers and a periwinkle wash. This inverts the stated hierarchy.
- **Dead `ChartRadar`.** A fully-built recharts radar (genre/subgenre distribution), exported, referenced by `chartConfig` and `description = 'A radar chart'` — never rendered. That component is the one genuinely DJ-specific data view conceived for this page and the sanctioned place for chart color. Its absence is the difference between "generic dashboard" and "tool that understands a collection."
- **Hero is three unlabeled buttons.** No heading, no welcome, no state ("14 tracks analyzed since you last visited"). A nav shortcut bar mislabeled as a hero.
- **Wrong five stats for the persona.** Tracks / Plays / Played Time / Favorites / Artists is a *listening* dashboard. "Played Time" (cumulative hours) has no curation value. A DJ prepping sets needs *pipeline* state — what's ready, what's new, what's unsorted.

**Deterministic scan:** Both `detect.mjs` runs (`src/components/home/home.tsx` and `src/components/home/`) returned `[]`, exit 0 — **fully clean, no rules triggered**. The mechanical detector was confirmed functional (`--help` renders, exit codes valid). So this critique is entirely the design-judgment layer: the detector's blind spot is exactly this kind of "every token is used correctly, but the composition is generic and the stats are wrong."

Manual pass (detector didn't flag, worth noting): `max-h-[250px]` arbitrary value (line 58); `border-none` overrides (lines 73, 106); `w-15` non-standard spacing token (line 134); `text-normal` — not a valid class, silently does nothing (line 121, likely meant `font-normal`); `text-3xl @[250px]/card:text-3xl` and `text-lg @[250px]/card:text-lg` — no-op responsive overrides (repeat the same value); magic number `10` duplicated between skeleton count and `.slice(0,10)`; trailing double-space in a className string (line 106).

**Visual overlays:** unavailable. The dev server requires backend auth and was not started, so there is no live URL, no browser inspection, and no user-visible overlay. Fallback signal: source review + clean CLI detector only.

## Overall Impression

The accessibility scaffolding is more careful than most of this codebase, but the page fails its two core jobs: it doesn't orient a first-timer and it doesn't help a daily user pick up where they left off. It's a vanity dashboard wearing a music app's labels. The single biggest opportunity: **replace the stat wall + genre badges with a state-aware hero** ("14 new tracks, 9 unanalyzed — start analysis") sitting above a bigger album-art rail, so the page finally looks like it belongs to Muzo and does something for the user on arrival.

## What's Working

1. **Section semantics.** Every `<section>` (except the hero) has `aria-labelledby` pointing at a real `<h2>`; button icons carry `aria-hidden` with visible text labels alongside. Solid a11y instinct.
2. **`HorizontalMusicCardList` empty state.** Dashed border, `bg-muted/30`, a primary message plus `max-w-sm` subtext, centered — follows the design system (soft, rounded, tonal). The one component on the page that handles its zero-state with craft.
3. **`preload="intent"` on every hero link** warms the route on hover — good perceived-performance instinct (even if undercut by the blocking loader).

## Priority Issues

### [P0] No h1, and no coherent first-run state
**Why it matters:** `PageShell` adds no heading and `PageHeader` (which carries the `sr-only` h1) isn't used here — so the app's home route has **no h1 at all**, a document-outline and screen-reader failure on the most important page. Compounding it: right after a first scan the page reads `Tracks: 1,240 / Plays: 0 / Played Time: 0 / Favorites: 0 / Artists: 0` — four zeros — and the genre/recent empty states tell the user to "play some tracks", when the actual next step is *run analysis*. The page thinks the user is a listener, not a curator.
**Fix:** Use `PageHeader title="Home"` or a visible welcome headline for a real h1. Add a first-run branch: `totalTracks === 0` → single CTA ("Point Muzo at a music folder →" to `/libraries`); tracks exist but `analyzed < total` → lead with "142 tracks waiting to be analyzed → Start analysis". Make the hero state-aware, not a static button bar.
**Suggested command:** `$impeccable onboard`

### [P0] `isLoading = false` hardcoded; loader blocks navigation with zero feedback
**Why it matters:** `StatsCardSkeleton`, `TopGenresSkeleton`, and the list skeleton are all unreachable dead code. The route loader `Promise.all`s two queries and blocks navigation until both resolve, so clicking "Home" from another route leaves the user staring at the *previous* page — no spinner, no skeleton, no progress — for however long the metrics aggregation takes on a large library.
**Fix:** Delete the `isLoading` const. Make the loader `preload`-only (don't `await` on the render path) and drive the page from `useQuery` with real `isPending` / `isError`, wiring the existing skeletons. The shell + skeletons should appear immediately on navigation.
**Suggested command:** `$impeccable harden`

### [P1] Periwinkle wash on all five stat cards breaks the One Voice rule
**Why it matters:** DESIGN.md: accent is "wayfinding and primary intent only… ≤10% of a screen." Five `bg-gradient-to-t from-primary/5 to-card` cards plus the primary hero button plus the active sidebar item push periwinkle well past 10%, and the stat-card usage points nowhere. This trains users to ignore periwinkle, which breaks its function everywhere else in the app. (The skeleton kills the gradient in dark mode with `dark:bg-card`; the live card doesn't — so dark mode, the primary working theme, keeps the wash.)
**Fix:** Stat cards use flat `bg-card` with `shadow-sm` (the resting-lift recipe) — "separate with tone and shadow, not color." Reserve periwinkle for the one primary CTA and any "you have N items to act on" badge.
**Suggested command:** `$impeccable quieter`

### [P1] The five stats are wrong for a curation persona
**Why it matters:** Tracks / Plays / Played Time / Favorites / Artists is a listening dashboard. "Played Time" is a Spotify-Wrapped metric with zero set-prep value. None of the cards are even links, so they're non-interactive dead ends.
**Fix:** Replace with prep-oriented, clickable stats, each linking to the filtered view that lets the DJ act: **Unanalyzed** (→ review filter), **Added this week**, **Playlists in progress**, **Fully tagged / ready**, **Needs artwork or key**. Keep "Tracks" as the one context anchor.
**Suggested command:** `$impeccable shape`

### [P2] Genre badges are cramped, mis-toned, and counts aren't mono
**Why it matters:** `size="sm"` (→ `text-sm`) fighting `h-6` + `p-3`; `<strong>{genre}:</strong> {count}` crams two data types into a pill built for one short label; `capitalize` mangles "UK garage" → "Uk Garage"; `justify-between` on `flex-wrap` throws the last row's items to opposite edges. Counts are machine values and should be Roboto Mono per the design system.
**Fix:** One value per badge — genre name only, `variant="secondary"`, no `p-3` override, natural `rounded-full`, `gap-2 flex-wrap` with default `justify-start`. Put the count in a mono superscript or tooltip, or drop it (a "top" list is already ranked). Fix casing with a label formatter, not `capitalize`.
**Suggested command:** `$impeccable typeset`

### [P2] Dead `ChartRadar` component
**Why it matters:** ~35 lines of exported, never-rendered recharts code plus its `chartConfig` and `description` export — the genre/subgenre distribution view, arguably the most DJ-relevant thing conceived for this page. Misleading to the next developer and ships unused recharts weight.
**Fix:** Decide. If genre distribution belongs here (it probably does — real crate-digging insight, the sanctioned place for chart color), render it in place of the badge row. If not, delete `ChartRadar`, `chartConfig`, `description`, and the recharts import.
**Suggested command:** `$impeccable distill`

## Persona Red Flags

**Alex (power user, daily driver):**
- CountUp animates on every session load — the `isLoaded` flag resets on every app boot and is only set after a sidebar click — so Alex opens Muzo to check last night's scan and watches "Tracks" animate up from a *wrong* value (70%) for a full second, every day.
- Non-interactive stat cards: "Favorites: 214" can't be clicked to go anywhere.
- Blocking loader freezes the app on the prior screen while metrics aggregate over a 20k-track library.
- No "resume" — nothing links back to the playlist Alex was building yesterday.

**Jordan (first-timer, just ran first scan):**
- Four zeros with no explanation.
- "Play some tracks to see your top genres" and "Play something from Music" both tell Jordan to *listen*; genres need *analysis*. Jordan follows the advice, plays a track, comes back — still empty. Misleading dead end.
- No h1, no welcome, no onboarding — a shortcut bar and a stat grid, zero orientation.
- "See all" only renders when `hasRecentTracks`, so Jordan never sees where the rail leads.

**Marco (DJ prepping a Friday set, opens Muzo Thursday night — project persona):**
- Hero tells him nothing: no "12 tracks added since Tuesday", no "your 'Warehouse' playlist has 8 tracks", no "23 tracks still need a key".
- "Played Time: 47h" — screen space that could show "tracks ready for harmonic mixing".
- Top Genres aren't links — Marco wants to browse *into* "deep house" to pull tracks.
- "Recently Played" is the wrong recency axis for set prep — Marco cares about recently *added* / *analyzed*, not what he auditioned.
- No "Harmonic" entry point in the hero, though `music-view.tsx` treats it as a first-class destination.

## Minor Observations

- `StatsCard`: `CardDescription` nested inside `CardTitle` (lines 121–123) — invalid semantics; the title's accessible name includes the label twice.
- Hero `<section>` has no `aria-labelledby` and no heading — the only unlabeled region on the page.
- `<h2>` section headers are `text-lg font-semibold`; DESIGN.md "Headline" is `text-2xl` / 600 — headings undersized vs the system's own scale, flattening hierarchy.
- `grid … xl:grid-cols-5` with the first card `sm:col-span-2 lg:col-span-1` — at `lg` (3 cols) you get 3 + 2, an unbalanced orphan row.
- Stat numbers use `tabular-nums` but Plus Jakarta Sans; "Played Time" is a duration — a machine value that DESIGN.md says should be Roboto Mono.
- `text-normal` (line 121) is not a Tailwind class — silently no-op; likely meant `font-normal`.
- `muted-foreground` on `background` in light mode ≈ 4.6:1 — passes AA for normal text but barely; the `text-sm` empty-state copy sits near the floor.
- Redundant `<div className="relative">` wrapping `HorizontalMusicCardList` (line 251) — the component already establishes its own relative container.
- CountUp `isDuration` branch runs `Math.floor(formattedValue / 3600)` on a string — relies on JS coercion, fragile.

## Questions to Consider

1. If you deleted the entire stat row and the genre badges and made the hero a single state-aware line ("14 new tracks, 9 unanalyzed — start analysis?") above the album-art rail — would any real user miss what you removed, or would the page finally look like Muzo?
2. Who is the home page *for*? A first-timer needs onboarding; a daily user needs "what changed + resume." It currently serves neither and hedges with vanity totals. Pick one.
3. The one genuinely DJ-specific artifact conceived for this page (the genre/subgenre radar) is commented out of existence while a "Played Time" counter ships. What does that inversion say about how this surface is being reasoned about?
4. Why does a local-first curation tool celebrate you with a count-up animation every session, when the number it animates is wrong (70%) during the animation and you opened the page to read that number accurately?
