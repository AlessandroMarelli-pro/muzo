---
name: Muzo
description: Local-first AI music library organization for DJs and crate-diggers
# Active theme: Vinyl Sleeve (src/styles/themes/vinyl-sleeve.css).
# Swap the @import in src/styles/index.css to change palettes; periwinkle.css
# is the previous world, kept as a rollback. All values below are the Vinyl
# Sleeve theme.
colors:
  background: "oklch(0.9555 0.0140 88.68)"
  foreground: "oklch(0.2813 0.0094 88.77)"
  card: "oklch(0.9162 0.0223 89.80)"
  card-foreground: "oklch(0.2813 0.0094 88.77)"
  popover: "oklch(0.9765 0.0098 87.47)"
  popover-foreground: "oklch(0.2813 0.0094 88.77)"
  primary: "oklch(0.4179 0.1249 258.70)"
  primary-foreground: "oklch(0.9696 0.0086 264.52)"
  secondary: "oklch(0.8832 0.0282 88.76)"
  secondary-foreground: "oklch(0.3919 0.0192 86.46)"
  muted: "oklch(0.9349 0.0197 87.52)"
  muted-foreground: "oklch(0.5055 0.0232 84.57)"
  accent: "oklch(0.9043 0.0253 89.22)"
  accent-foreground: "oklch(0.3919 0.0192 86.46)"
  destructive: "oklch(0.5648 0.1755 30.69)"
  destructive-foreground: "oklch(0.9700 0.0130 40)"
  success: "oklch(0.4661 0.0742 129.78)"
  success-surface: "oklch(0.9119 0.0322 124.50)"
  warning: "oklch(0.6488 0.1157 74.5)"
  warning-surface: "oklch(0.9153 0.0473 88.30)"
  info: "oklch(0.4179 0.1249 258.70)"
  info-surface: "oklch(0.9156 0.0190 255.54)"
  border: "oklch(0.8744 0.0312 88.38)"
  ring: "oklch(0.4179 0.1249 258.70)"
  sidebar: "oklch(0.9162 0.0223 89.80)"
  sidebar-border: "oklch(0.8376 0.0343 88.07)"
  sidebar-active: "oklch(0.4179 0.1249 258.70)"
  sidebar-active-foreground: "oklch(0.9696 0.0086 264.52)"
  chart-1: "oklch(0.3205 0.0885 257.60)"
  chart-2: "oklch(0.4179 0.1249 258.70)"
  chart-3: "oklch(0.5298 0.1204 256.66)"
  chart-4: "oklch(0.6651 0.0976 255.76)"
  chart-5: "oklch(0.8006 0.0596 252.49)"
  dark-background: "oklch(0.2363 0.0120 84.56)"
  dark-foreground: "oklch(0.9316 0.0169 88.00)"
  dark-card: "oklch(0.2744 0.0154 84.54)"
  dark-primary: "oklch(0.6437 0.1182 255.94)"
  dark-muted-foreground: "oklch(0.6575 0.0260 79.67)"
  dark-border: "oklch(0.3032 0.0187 84.52)"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "normal"
  headline:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "normal"
  body:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "normal"
  mono:
    fontFamily: "Roboto Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "1rem"
  md: "1.125rem"
  lg: "1.25rem"
  xl: "1.5rem"
  full: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-ghost:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "1.5rem 0"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.75rem"
    height: "2.25rem"
  badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
---

# Design System: Muzo

## Overview

**Creative North Star: "The Crate Room, filed on printed sleeves"**

Muzo is a room where a DJ goes to dig. The interface has crate-room energy:
album art forward, dense enough to browse a large collection quickly, and
deliberately low on chrome so the music does the talking. Cards are the primary
object on screen and they lead with cover imagery — the UI frames the artwork,
it doesn't compete with it. The chrome that remains is soft: generously rounded
corners (`--radius: 1.25rem`) and diffuse ambient shadows keep every surface
feeling like a physical object you could pick up, never a hard-edged panel.

The layout is the crate; the palette is the jacket you pull from it.

The colour world is **the printed record sleeve**: uncoated stock, spot-colour
ink, the flat confident fields of a Blue Note or Factory jacket. One deep spot
blue is the whole palette — and unlike an accent, it is used as an *area*: the
active nav block is a solid blue field, primary buttons are filled blue, the
recommendation chart is five steps of it. One spot red handles delete and error.
Everywhere else is warm-grey paper and charcoal ink. The stock is deliberately
warm-grey, not cream — cream-plus-sans is a design cliché the sleeve world
sidesteps by committing the blue as a field rather than a hairline.

The system is fully dual-theme. Dark mode is not an afterthought — it is the
expected working environment for an off-gig prep session — and the dark palette
is a warm "press-room" black (not neutral charcoal) with the blue brightened one
notch so it still reads as a field against it. Album art pops against both.

**Key Characteristics:**
- Album art is the hero; cards frame it and stay out of its way
- One committed colour (spot blue), used as a *field* — nav-active, primary
  buttons, chart series — not a scattered accent
- Warm-grey "stock" surfaces and charcoal ink, like an uncoated jacket
- One spot red, for delete and error only
- Very generous rounding (16–24px) on every interactive surface
- Soft ambient shadows — the one concession to screen; print has none
- Dark mode is a first-class working environment, not a toggle afterthought

## Colors

The full palette lives in a swappable theme file (`src/styles/themes/`) — see
**The Theme System** below. Values here are the active **Vinyl Sleeve** theme.

### Primary
- **Spot Blue** (`oklch(0.4179 0.1249 258.70)` light / `oklch(0.6437 0.1182 255.94)` dark):
  The one committed colour. Used as a *field*: the primary button fill, the
  active sidebar cell (a solid block, not a tint), focus rings, selected states,
  default badges, `--wave-played`, and the recommendation chart ramp. It reads
  as ink on a jacket — flat, confident, not a glow. In dark mode it brightens so
  it still carries against the press-room black.

### Neutral
- **Stock** — Background (`oklch(0.9555 0.0140 88.68)` light /
  `oklch(0.2363 0.0120 84.56)` dark): the page ground. A warm paper grey, low
  chroma; in dark, a warm near-black ("press room"), not a neutral charcoal.
- **Inner Sleeve** — Card (`oklch(0.9162 0.0223 89.80)` light /
  `oklch(0.2744 0.0154 84.54)` dark): one tonal step off the stock. Cards, the
  sidebar, and secondary buttons share this value, so the layout reads as one
  continuous paper stock with gentle tonal separation rather than stacked panels.
- **Popover** (`oklch(0.9765 0.0098 87.47)` light / equals Inner Sleeve in dark):
  a shade brighter than the card in light mode, to lift menus and dialogs forward.
- **Ink** — Foreground (`oklch(0.2813 0.0094 88.77)` light /
  `oklch(0.9316 0.0169 88.00)` dark): primary text. A warm near-black in light,
  a warm off-white in dark — the ink and the paper share a hue.
- **Warm Grey** — Muted Foreground (`oklch(0.5055 0.0232 84.57)` light /
  `oklch(0.6575 0.0260 79.67)` dark): secondary text, captions, `CardDescription`,
  the idle nav-icon colour, and — via a global `[data-description]` rule — every
  Radix description slot.
- **Hairline** — Border (`oklch(0.8744 0.0312 88.38)` light /
  `oklch(0.3032 0.0187 84.52)` dark): applied globally by default
  (`* { @apply border-border }`). Near-invisible against the stock; separation
  comes from tone and shadow, not lines.
- **Rule** — Sidebar Border / Input (`oklch(0.8376 0.0343 88.07)` light /
  equals Hairline in dark): one step darker than the sidebar surface — unlike
  the app `border` this one is meant to be faintly visible, for the rail's
  nav/crate divider and for form-field edges.
- **Sidebar Active** (`oklch(0.4179 0.1249 258.70)` light /
  `oklch(0.3896 0.0806 254.28)` dark) with **Sidebar Active Foreground**
  (`oklch(0.9696 0.0086 264.52)` light / `oklch(0.8502 0.0488 255.13)` dark):
  a **solid blue field** behind the active nav icon — an ink block on the
  sleeve. In dark mode the field deepens so the pale-blue icon reads on it.
  This is the thesis of the direction: the accent is an area, not a dot.

### Destructive
- **Spot Red** (`oklch(0.5648 0.1755 30.69)`): delete actions and error states
  only. The same value in both themes, with a near-white `destructive-foreground`
  (`oklch(0.97 0.013 40)`). The one warm colour in an otherwise blue-and-paper
  system, so it always means "stop."

### Semantic Status
A small, deliberately muted set of status roles — the only colours besides the
spot blue and spot red in the system. Each is used as a **tinted badge or pill**
(`*-surface` fill, `*-border` hairline, hue-matched `*-foreground` text), and
each **always travels with an icon and a text label** so status is never
communicated by colour alone. The solid `success` / `warning` / `info` values
are for icons and single lines of text on the page ground, not large fills.

- **Success — moss green** (`oklch(0.4661 0.0742 129.78)` light /
  `oklch(0.8097 0.0967 134.17)` dark): scan complete, analysis done, account
  connected, track kept. The resolved / good state — a printerly green that sits
  next to the blue without competing.
- **Warning — muted amber** (`oklch(0.6488 0.1157 74.5)` light /
  `oklch(0.8161 0.1198 82.5)` dark): incomplete tracks, paused scans, "needs a
  look." Also the fill of the swipe "banger" action (with `warning-ink`, a fixed
  dark text value that does not flip between themes). Draws the eye without the
  alarm of the spot red.
- **Info — the spot blue, held to a wash** (`--info` equals `--primary`;
  `--info-surface` is `--vs-blue-wash`, a pale tint on the stock): work in
  progress — scanning, analyzing. It shares the primary's hue on purpose but
  only ever appears as a wash, so an in-progress state reads as related to the
  primary without spending the full-strength blue field.

**The Muted Status Rule.** Status colour is rationed like the primary. It
appears as a tint on a chip, carries an icon and a word, and stays low-chroma.
If a status needs a saturated fill to be noticed, the layout is burying it.

### Named Rules
**The Field Rule.** The spot blue is used as an *area*, not an accent dot: a
solid fill behind the active nav icon, the whole primary button, the full chart
series. This is the sleeve thesis — ink is printed in blocks. It still stays off
most of the screen (the stock and ink carry the bulk), but where it appears it
is committed, not a hairline or a 3px tick alone.

**The One Warm Colour Rule.** In a blue-and-paper system the spot red is the
only warm colour, so it always and only means "stop" — delete, error, the
current-beat marker. Never use it decoratively; never introduce a second warm
hue to sit beside it.

**The Ghost Border Rule.** Borders share the stock/card tonal family and all but
disappear. Reach for a tonal shift or a soft shadow to separate surfaces before
you reach for a visible line. The exceptions are `--sidebar-border` and
`--input`, which are one step darker and meant to be faintly seen.

**The Favorite-Heart Exception.** The one place a raw Tailwind colour is
sanctioned: the favourite/like heart uses `fill-red-500 text-red-500`. A red
heart is a near-universal convention and routing it through `--destructive`
would wrongly link "favourite" and "delete." It is the single exception to
"every colour is a token."

## The Theme System

Colour is separated from structure so a whole palette can be swapped in one line.

- **`src/styles/index.css`** owns only structural tokens — fonts, `--radius`,
  the `--shadow-*` recipe, `--spacing`, z-index — and the `@theme inline` bridge
  that maps every `--token` to a Tailwind `--color-*` utility. It ends with one
  `@import './themes/<name>.css';` — **that import is the palette switch.**
- **`src/styles/themes/<name>.css`** defines *only* colour tokens, as a
  `:root { }` (light) + `.dark { }` (dark) pair. Each file has two layers: a
  private **primitive ramp** at the top (`--vs-blue`, `--vs-stock`, … / `--pw-*`
  for periwinkle) and then the **semantic tokens** that reference it
  (`--primary: var(--vs-blue)`). Recolouring is mostly rewriting the ramp;
  "darken the accent one step" is a one-line primitive edit.
- **`themes/_contract.css`** documents the full semantic token list a theme must
  define. `npm run theme:check` (also `prebuild`) parses it and every theme file
  and fails if a theme is missing a token in either block — a half-finished
  palette can't ship.
- **Available themes:**
  - `vinyl-sleeve.css` — **active.** Spot blue as a field, warm paper stock.
  - `periwinkle.css` — the previous world (Shadcn "New York" violet), kept
    verbatim as the rollback.
  - `sodium-neon.css` — "Sodium & Neon at 2am": the record shop at closing.
    A rare, directional sodium-orange accent (primary action / active path /
    now-playing tick, *not* a filled field), deep blue-grey night neutrals in
    dark, and a fluorescent cyan reserved for the `info` status and the chart
    tail. All AA-verified, not currently wired.
  To switch, change the one `@import` in `index.css` and update this doc's
  frontmatter + Colors section to describe the newly-active theme.
- **Canvas colours** (`beat-visualizer`, `waveform-visualizer`) read tokens via
  `getComputedStyle` and blend alpha with `color-mix(in oklab, …)` — never
  `hsl(var(--token))`, which is invalid against oklch values.

To add a palette: copy `periwinkle.css`, rewrite its primitive ramp, run
`npm run theme:check`, switch the import. Document the built result here (this
frontmatter + the Colors section) — the theme file is the source of truth, this
doc describes the active one.

## Typography

**Display / Body Font:** Plus Jakarta Sans (with `ui-sans-serif, system-ui, sans-serif`)
**Mono Font:** Roboto Mono (with `ui-monospace, monospace`)
**Serif (rare):** Lora — available as `--font-serif` but effectively unused;
treat the system as sans + mono.

**Character:** Plus Jakarta Sans is a humanist geometric sans with slightly
rounded terminals — it echoes the rounded-corner language of the shapes and
keeps dense track lists feeling approachable rather than spreadsheet-cold. One
family does display through label; hierarchy comes from weight and size, not
from a second typeface.

### Hierarchy
- **Display** (700, 1.875rem / `text-3xl`, line-height ~1.1): Page titles and
  hero counts (e.g. `CountUp` stat numbers).
- **Headline** (600, 1.5rem / `text-2xl`): Section headers within a page.
- **Title** (600, 1rem, line-height 1): `CardTitle`, track titles, list-row
  primary text. Semibold with tight leading.
- **Body** (400, 0.875rem / `text-sm`): The system default. Almost all UI text
  sits here. `text-base` on mobile inputs stepping down to `text-sm` on `md`.
- **Label** (500, 0.75rem / `text-xs`): Badges, metadata chips, table column
  headers, helper text. Medium weight, no forced uppercase.
- **Mono** (400, 0.875rem, Roboto Mono): Technical values only — BPM, key,
  duration, file paths, audio-feature readouts.

### Named Rules
**The One Family Rule.** Plus Jakarta Sans carries the entire interface.
Hierarchy is weight (400/500/600/700) and size, never a swapped typeface.
Mono is reserved strictly for machine values a user might read digit by digit.

## Layout

The app shell is a **fixed narrow navigation rail** (`4.5rem`, `sidebar`
surface — see Navigation) plus a scrollable main inset, with a fixed
music-player bar docked to the bottom when a track is loaded (`mb-20 sm:mb-16`
reserved on the inset so content is never hidden behind it). The rail itself
also stops at the top of the player bar. A `SiteHeader` sits above the inset
content.

Spacing rhythm is a 0.25rem base (`--spacing`). Cards use a `gap-6` (1.5rem)
internal stack and `px-6` gutters. Card grids and horizontal rails use `gap-6`.
Horizontal "crate rail" lists (`HorizontalMusicCardList`) scroll on the x-axis
with `overflow-x-scroll` and a `pb-3` scrollbar gutter — browsing wide is a
first-class pattern, not a fallback.

Density is medium-high: track tables and lists are built to scan hundreds of
rows. Responsive behavior hides the rail below `md` (a `SidebarTrigger` opens
it as an overlay Sheet) and stacks card content vertically
(`flex-col sm:flex-row`) below `sm`.

## Elevation & Depth

Ambient and soft. Shadows are atmosphere: they lift cards a few millimetres off
the stock at rest and never read as hard or directional. The shadow vocabulary
is a single diffuse recipe scaled up — a 2px/2px offset with a 10px blur and 4px
spread, at 18% opacity, warm grey in light mode (`#a6a7ab`) and near-black in
dark. There is no crisp drop shadow anywhere in the system. (Print has no
shadow at all — this is the one screen concession the sleeve world makes.)

Secondary depth comes from tonal layering: background → card → popover is a
three-step lightness climb, and in light mode that tonal step (not a border or
a shadow) is often the only thing separating a card from the page.

### Shadow Vocabulary
- **Resting lift** (`--shadow-sm` / `--shadow`): `2px 2px 10px 4px hsl(228 2.9% 66% / 0.18), 2px 1px 2px 3px hsl(228 2.9% 66% / 0.18)`.
  Cards at rest.
- **Control hint** (`--shadow-xs`): `2px 2px 10px 4px hsl(228 2.9% 66% / 0.09)`.
  Buttons, inputs — a barely-there grounding.
- **Raised** (`--shadow-md` / `--shadow-lg` / `--shadow-xl`): progressively more
  vertical spread for popovers, dialogs, and dragged items.

### Named Rules
**The No Hard Edge Rule.** Every shadow in the system is diffuse and low-contrast.
If a shadow looks like a crisp line under an element, it is wrong — soften the
blur and drop the opacity.

## Shapes

The defining gesture is generous rounding. Base radius is `1.25rem` (`--radius`),
with the scale derived from it: `sm` = radius − 4px (~1rem), `md` = radius − 2px
(~1.125rem), `lg` = radius (1.25rem), `xl` = radius + 4px (1.5rem). Buttons and
inputs use `rounded-md`; cards use `rounded-xl`; badges, avatars, and chips are
fully round (`rounded-full`, `9999px`).

Album art inside cards is itself rounded (`rounded-md`), and card content often
splits into a rounded-top image zone and a rounded-bottom info zone
(`rounded-t-md` / `rounded-b-md`) so the artwork and its metadata read as two
stacked pills. Borders, where visible at all, are 1px.

There are no sharp corners in the system. Even the smallest interactive target
carries at least a 1rem radius.

## Components

### Buttons
- **Shape:** Gently rounded (`rounded-md`, ~1.125rem). `sm` and `lg` sizes keep
  the same `rounded-md`.
- **Sizes:** default `h-9 px-4`, `sm` `h-8 px-3 text-xs`, `lg` `h-10 px-8`, plus
  icon sizes `icon` (h-9 w-9), `iconSm` (h-6), `iconXs` (h-4).
- **Primary:** `bg-primary` spot blue, `primary-foreground` text, `shadow-xs`.
  Hover drops to `bg-primary/90`. A filled ink block — tactile and confident.
- **Secondary:** `bg-secondary` (one step off the card), `secondary-foreground`
  text, hover `bg-secondary/80`.
- **Outline:** `border-input` on `bg-background`, hover fills `bg-accent` with
  `accent-foreground`.
- **Ghost:** transparent at rest, hover fills `bg-accent`. For low-emphasis
  toolbar actions.
- **Link:** spot-blue text, underline on hover.
- **Transition:** colour, background, box-shadow and `transform` on the app's
  `--ease-out` curve at `--dur-press` (120ms). **Press feedback:** `active:scale-[0.97]`
  (reset under `prefers-reduced-motion`). Focus: `ring-1 ring-ring` (spot blue).
- **Cursor:** buttons set `cursor-pointer` explicitly.

### Chips / Badges
- **Style:** Fully round (`rounded-full`), `px-2 py-0.5 text-xs font-medium`,
  transparent border.
- **Variants:** `default` (spot blue / `primary-foreground`), `secondary` (one
  step off the card / foreground), `accent` (accent surface / accent-foreground),
  `outline` (foreground text, hover tint), `destructive` (spot red / near-white),
  `success` / `warning` / `info` (tinted surface + hairline + hue-matched text —
  always with an icon), `foreground` (inverted: foreground bg / background text).
- **Use:** genre and subgenre tags on track cards, audio-quality badges, counts.
  Genre badges are the densest recurring use — expect many per card.

### Cards / Containers
- **Corner Style:** `rounded-xl` (1.25rem).
- **Background:** `bg-card`, one tonal step off the page.
- **Shadow:** `shadow-sm` resting lift (see Elevation).
- **Border:** 1px `border` — near-invisible in light mode by design.
- **Internal Padding:** `py-6` with `px-6` on header/content/footer; `gap-6`
  vertical rhythm.
- **Music cards specifically:** often `border-none` and `py-0`, with a
  full-bleed blurred album-art backdrop at `opacity-50`, a `backdrop-blur-md`
  image zone on top, and a solid `bg-card` info strip at the bottom. Hover
  reveals a centered play button behind a `bg-background/90` mask fade
  (`motion` opacity, 0.3s `easeInOut`).

### Inputs / Fields
- **Style:** `h-9`, `rounded-md`, 1px `border-input`, `bg-transparent`,
  `shadow-xs`, `text-base` on mobile / `text-sm` on `md`+.
- **Focus:** `outline-none` + `ring-1 ring-ring` (spot blue). No glow, just a
  clean single-pixel ring.
- **Placeholder:** `text-muted-foreground`.
- **Disabled:** `cursor-not-allowed opacity-50`.

### Navigation (The Rail)
The desktop navigation is a **fixed narrow icon rail** (`--sidebar-width-icon`
= `4.5rem`) on the `sidebar` surface — it never expands. The metaphor is a
record box: icons up top, your crates filed right below as cover art.

- **Nav cells:** `size-10` `rounded-xl` cells holding a `~1.15rem` Lucide icon,
  idle at `text-sidebar-foreground/75`, stacked `gap-1` with an `mt-5`
  finger-gap between the two route groups (group labels are structural only —
  `aria-label` on the `<ul>`, never rendered). No counts, no visible dividers
  in the nav block.
- **Active cell:** a **solid spot-blue field** (`bg-sidebar-active`) with
  `text-sidebar-active-foreground` (near-white in light, pale blue on the deeper
  dark field — both clear AA), plus a 3px blue tick (`--sidebar-primary`)
  detached to the rail's left edge (`-left-[13px]`), vertically centred on the
  icon. An ink block on the sleeve, per The Field Rule. Longest-matching-URL
  wins, so `/music/harmonic` lights Harmonic, not Music.
- **Hover / focus label:** a floating pill on the `popover` surface
  (`rounded-md`, `shadow-md`, `text-xs`) to the right of the item, via the
  shared Tooltip primitive so keyboard focus reveals it too (`RailLabel`).
- **Crate strip:** below a hairline `sidebar-border/70` divider, a vertical
  `overflow-y-auto` column of 40px `rounded-lg` playlist covers — a 2×2 mosaic
  from `stats.images`, a single image, or a spot-blue monogram tile as
  fallback. `mask-image` linear-gradient fade top and bottom, scrollbar hidden
  (`.no-scrollbar`), each cover `hover:scale-105` with its name in the same
  label pill. Clicking a cover opens that crate.
- **Ends:** the `Disc3` mark in a spot-blue `rounded-xl` tile pinned top; the
  user's initials avatar (`size-9`, opens the account dropdown to the right)
  pinned bottom. The fixed rail stops at the top of the player bar
  (`bottom: var(--music-player-height)`) so the avatar is never covered.
- **Mobile:** the rail is hidden; `SidebarTrigger` (mobile-only) opens the same
  content as an overlay Sheet.
- **Icon set:** Lucide React throughout, one stroke weight.

### Signature: The Music Player Bar
A persistent bottom-docked bar (`EnhancedMusicPlayer`) that appears only when a
track is loaded. The main inset animates its bottom margin
(`transition-[margin-bottom] duration-200 ease-linear`) to make room. Carries
transport controls, a live p5.js waveform, and a beat visualizer. It is the one
piece of chrome allowed to stay visually present at all times.

### Signature: Crate Rails
`HorizontalMusicCardList` — a horizontally scrolling row of album-art cards with
`gap-6` and a subtle `from-primary/5 to-card` gradient wash on each card in
light mode (flat `bg-card` in dark). This is the primary browse-a-lot pattern.

## Do's and Don'ts

### Do:
- **Do** lead every track/library/playlist card with cover artwork; frame it,
  don't crop it out.
- **Do** use the spot blue as a *field* for wayfinding and primary intent —
  the active nav block, the primary button, current selection, the chart series.
  Filled, not a hairline.
- **Do** separate surfaces with a tonal step (stock → card → popover) and a
  soft `shadow-sm` before reaching for a visible border.
- **Do** use `rounded-md` for controls, `rounded-xl` for cards, `rounded-full`
  for badges and avatars. Nothing sharper than 1rem.
- **Do** design dark mode as the primary working environment and verify album
  art still reads against the press-room black.
- **Do** use Roboto Mono for BPM, key, duration, and file paths only.
- **Do** support horizontal scrolling rails as a real browsing pattern.
- **Do** honor `prefers-reduced-motion` — the base layer already forces near-zero
  durations; keep motion non-essential. `motion/react` components (WAAPI-driven,
  not covered by the CSS clamp) must gate spatial props behind `useReducedMotion()`
  and fall back to an opacity/colour transition.
- **Do** draw timing from the shared scale in `index.css` — `--ease-out`
  (`cubic-bezier(0.16,1,0.3,1)`, the confident-arrival curve), `--dur-press` 120ms,
  `--dur-state` 200ms, `--dur-move` 320ms. `motion` components use the same numbers
  (`{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }`).

### Motion inventory
- **Buttons** — press dip (see Buttons).
- **Tabs** (`ui/tabs.tsx`) — same mechanism as the nav rail: one
  absolutely-positioned marker element in `TabsList` that measures the active
  trigger and slides between triggers via a CSS `transform`/`width` transition
  (300ms, `--ease-out`). Re-measures on tab change (MutationObserver on
  `data-state`) and resize; the first placement is transition-suppressed.
- **Idle nudge** (`.nudge-idle` in `index.css`) — a small periodic hop
  (`nudge-hop`, ~3.2s cycle, mostly rest) that draws the eye to an idle CTA;
  stops on hover/focus/active and under `prefers-reduced-motion`. Used on the
  home briefing's "Open playlist" button.
- **Camelot wheel** (`harmonic/camelot-wheel.tsx`) — the one authored moment:
  on select, compatible segments settle / the rest recede (`transition-[opacity,transform]`),
  the chosen segment lifts `scale-1.04`, its outline draws in (`motion.path` `pathLength`),
  and the centre label swaps.
- **Pending table focus** (`data-table/data-table.tsx`) — 3px spot-blue bar on
  the focused row's first cell, growing in via a `scale-y` transform transition
  (200ms). Drawn on the `<td>`, not the `<tr>`, whose `content-visibility`
  containment blocks the transition. Row tint fades via `TableRow`'s transition.
- **Playlist card hover** (`playlist/playlist-card.tsx`) — art `scale-1.03`,
  overlay + action buttons fade and rise (`y: 4 → 0`, 40ms stagger).

### Don't:
- **Don't** introduce a second field colour. The spot blue is the whole palette;
  the spot red is "stop" only. If a screen seems to need another colour, fix the
  hierarchy instead. (The semantic status roles — success/warning/info — are not
  accents: they are muted, icon-and-label bound, and used only as chip tints.)
- **Don't** reach for a raw Tailwind colour (`text-green-500`, `bg-orange-500`).
  Every colour is a token — `primary`, `destructive`, `success`, `warning`,
  `info` and their `-surface` / `-border` / `-foreground` pairs. The one
  sanctioned exception is the `red-500` favourite heart (see The Favorite-Heart
  Exception).
- **Don't** hardcode a colour in canvas code as `hsl(var(--token))` — the tokens
  are `oklch()`. Read them with `getComputedStyle` and blend alpha with
  `color-mix(in oklab, …)`, as `beat-visualizer` and `waveform-visualizer` do.
- **Don't** use hard, crisp, or directional drop shadows. Every shadow is
  diffuse and ≤18% opacity.
- **Don't** add a second typeface for emphasis — use weight (400/500/600/700)
  and size within Plus Jakarta Sans.
- **Don't** put visible 1px lines everywhere; the system separates with tone and
  soft shadow.
- **Don't** rely on the Poppins / Fira Code / AR One Sans families still loaded
  in `index.html` — they are legacy and slated for removal; Plus Jakarta Sans,
  Roboto Mono, and Lora are the only real families.
- **Don't** let chrome compete with album art for visual weight.
- **Don't** make interactive targets smaller than the `iconXs` (1rem) footprint
  or drop below AA contrast on `muted-foreground` text.
