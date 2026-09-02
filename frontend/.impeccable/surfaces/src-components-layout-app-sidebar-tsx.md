---
version: 1
slug: "src-components-layout-app-sidebar-tsx"
primary_target: "src/components/layout/app-sidebar.tsx"
related_targets: ["src/components/nav-main.tsx","src/components/nav-user.tsx"]
---

# Surface: App Navigation Sidebar

Scope: the persistent left navigation rail (`app-sidebar.tsx`, `nav-main.tsx`, `nav-user.tsx`), rendered on every authenticated route via `__root.tsx`. App chrome, not a page.
Visitor mode: Operate.

Audience: DJs / crate-diggers with large local libraries, working off-gig, cycling scan → analyze → organize → build sets.
Job: reach any surface fast, jump straight to a playlist-in-progress, keep maximum room for the content area.
Must stay untouched: Muzo's app-wide visual world (DESIGN.md — periwinkle accent, warm near-neutral surfaces, generous rounding, soft ambient shadow, Plus Jakarta Sans / Roboto Mono, dual theme); the route set and URLs; TanStack `<Link>` navigation; the mobile Sheet behaviour; WCAG 2.1 AA.
Constraints: fixed narrow width (~72px), icon-only, no expand/collapse toggle; labels appear on hover as a floating pill; must stay fast at the top of a 10k-track app; no new fonts, no second accent colour, no hard shadows.

Chosen direction: **The Rail** — a narrow icon-only navigation rail (Tidal / Chatdong pattern), label on hover, with a scrollable strip of playlist cover mosaics below the nav icons: the rail literally is the crate room, and the covers are the records you flip past.
Memorable moment: hovering a nav icon floats its label in a small `popover`-surface pill to the right; the recent-crate covers below scroll independently and lift on hover.

Unresolved: whether the crate strip shows all playlists or a recent subset; fade treatment at the strip's scroll edges.

## Direction contract

THESIS: Navigation is a narrow rail you read by icon and muscle memory, with your crates filed right below it as cover art — the sidebar is the record box, not a menu. Refuses the wide labelled SaaS list and its section headers, counts, and dividers.

OWN-WORLD: Muzo's established world, unchanged palette and type. A ~72px rail on the `sidebar` surface. Nav icons are `size-5`, stacked with generous `gap` (≈14px), each a 40px hit target. Active item: a filled `sidebar-active` rounded-square (rounded-xl) behind the icon + a 3px periwinkle tick flush to the rail's left edge, vertically centred on the icon. Hover: `sidebar-accent` fill on the square, and a label pill (`popover` surface, `rounded-md`, `shadow-md`, `text-xs`) floats to the right. A hairline `sidebar-border` divider between the nav block and the crate strip. The crate strip: vertical `overflow-y-auto` column of 44px rounded-md playlist covers (2×2 mosaic from `stats.images`, single image or periwinkle-tinted monogram as fallback), `gap-2`, soft mask-image fade top and bottom, each cover lifts `scale-105` + `shadow-sm` on hover with its name in the same label pill. Logo mark (`Disc3` in a periwinkle tile) pinned top; user avatar (initials tile, opens the existing dropdown) pinned bottom. Roboto Mono nowhere here — no counts in this design.

STORY: The DJ lands, reads the lit rounded-square to see where they are, and either clicks a nav icon (label confirms on hover) or clicks straight into a crate cover below to resume a set. The content area gets the full width back.

FIRST VIEWPORT: 72px rail, full height, ending at the player bar. Top: the `Disc3` periwinkle tile, 40px, centred. 16px gap. The nav icons — Home, Music, Harmonic, Libraries, then a smaller gap, then Pending, Research, Favorites, Playlists — each centred in a 40px rounded-xl cell, the active one filled with the periwinkle tick at the rail edge. Below the last icon: a hairline divider, then the crate strip scrolling covers to the bottom, edge-faded. Footer: the user avatar tile, 36px, centred, opening the account dropdown upward. No labels visible at rest; hover floats them.

FORM: The Rail — narrow icon rail + crate-art strip (Tidal / Chatdong reference). #1 on the reconsidered candidate list after the user's reference images (Rail, Divider tabs, Prep bench, Stack, Console strip, Contact sheet, Ledger margin). Seed key: 2cf882ca (surface scope, operate mode).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
