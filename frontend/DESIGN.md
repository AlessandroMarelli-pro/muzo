---
name: Muzo
description: Local-first AI music library organization for DJs and crate-diggers
colors:
  background: "oklch(0.9918 0.0011 17.1778)"
  foreground: "oklch(0.3102 0.0265 244.3187)"
  card: "oklch(0.9325 0.0022 17.1973)"
  card-foreground: "oklch(0.3102 0.0265 244.3187)"
  popover: "oklch(1 0 0)"
  popover-foreground: "oklch(0.3102 0.0265 244.3187)"
  primary: "oklch(0.7205 0.1038 273.6722)"
  primary-foreground: "oklch(1 0 0)"
  secondary: "oklch(0.9325 0.0022 17.1973)"
  secondary-foreground: "oklch(0.4864 0.0199 242.7423)"
  muted: "oklch(0.9918 0.0011 17.1778)"
  muted-foreground: "oklch(0.5996 0.0167 251.2515)"
  accent: "oklch(1 0 0)"
  accent-foreground: "oklch(0.4099 0.0228 243.4564)"
  destructive: "oklch(0.6823 0.1365 10.3688)"
  destructive-foreground: "oklch(1 0 0)"
  border: "oklch(0.9325 0.0022 17.1973)"
  ring: "oklch(0.7205 0.1038 273.6722)"
  sidebar: "oklch(0.9325 0.0022 17.1973)"
  sidebar-border: "oklch(0.8895 0.0035 17.1973)"
  sidebar-active: "oklch(0.8807 0.0556 273.6722)"
  sidebar-active-foreground: "oklch(0.3771 0.1178 273.6722)"
  chart-1: "oklch(0.7205 0.1038 273.6722)"
  chart-2: "oklch(0.6214 0.1372 275.9795)"
  chart-3: "oklch(0.5464 0.1374 276.5018)"
  chart-4: "oklch(0.4647 0.1344 274.8044)"
  chart-5: "oklch(0.4202 0.0982 274.837)"
  dark-background: "oklch(0.18 0 0)"
  dark-foreground: "oklch(1 0 0)"
  dark-card: "oklch(0.293 0.0061 34.2971)"
  dark-primary: "oklch(0.811 0.0692 269.2988)"
  dark-muted-foreground: "oklch(0.7733 0.0109 247.9677)"
  dark-border: "oklch(0.3557 0.0065 48.5318)"
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

**Creative North Star: "The Crate Room"**

Muzo is a room where a DJ goes to dig. The interface has crate-room energy:
album art forward, dense enough to browse a large collection quickly, and
deliberately low on chrome so the music does the talking. Cards are the primary
object on screen and they lead with cover imagery — the UI frames the artwork,
it doesn't compete with it. The chrome that remains is soft: generously rounded
corners (`--radius: 1.25rem`) and diffuse ambient shadows keep every surface
feeling like a physical, pillowy object you could pick up, never a hard-edged
panel.

Color is rationed. The surfaces are a near-neutral warm grey that functions as a
quiet stage: its job is to recede so that cover art and a single periwinkle
accent carry all the color in the room. That accent — a soft, muted blue-violet
— is used for wayfinding only: the active nav item, the primary action, the
"you are here" signal, and the recommendation chart series. Everywhere else the
system stays in neutrals and lets content fill the frame.

The system is fully dual-theme. Dark mode is not an afterthought — it is the
expected working environment for an off-gig prep session — and the warm charcoal
dark palette is tuned so album art still pops against it.

**Key Characteristics:**
- Album art is the hero; cards frame it and stay out of its way
- One accent (periwinkle), used sparingly for wayfinding and primary actions
- Warm near-neutral surfaces as a deliberately quiet stage
- Very generous rounding (16–24px) on every interactive surface
- Soft ambient shadows — atmosphere, not hard elevation
- Dark mode is a first-class working environment, not a toggle afterthought

## Colors

A near-neutral warm-grey system with a single periwinkle accent. Content
(album art, charts) supplies the color; the chrome does not.

### Primary
- **Soft Periwinkle** (`oklch(0.7205 0.1038 273.67)` light / `oklch(0.811 0.0692 269.30)` dark):
  The one accent. Used for the primary button, the active sidebar item, focus
  rings, selected states, default badges, and the recommendation chart ramp
  (`chart-1` through `chart-5` are all shades of it). Muted, never electric —
  it reads as a calm signal, not an alarm.

### Neutral
- **Quiet Stage** — Background (`oklch(0.9918 0.0011 17.18)` light /
  `oklch(0.18 0 0)` dark): The page ground. Very low chroma, faintly warm.
  Deliberately recessive so nothing on it has to fight for attention.
- **Card Surface** (`oklch(0.9325 0.0022 17.20)` light / `oklch(0.293 0.0061 34.30)` dark):
  One tonal step off the background. Cards, the sidebar, and secondary buttons
  share this value, so the layout reads as one continuous soft material with
  gentle tonal separation rather than stacked panels.
- **Popover** (`oklch(1 0 0)` light / `oklch(0.293 0.0061 34.30)` dark):
  Pure white in light mode for menus, dropdowns, and dialogs — the one place the
  system goes brighter than the card surface to lift transient UI forward.
- **Foreground** (`oklch(0.3102 0.0265 244.32)` light / `oklch(1 0 0)` dark):
  Primary text. A soft dark blue-grey in light mode rather than true black.
- **Muted Foreground** (`oklch(0.5996 0.0167 251.25)` light /
  `oklch(0.7733 0.0109 247.97)` dark): Secondary text, captions, `CardDescription`,
  and — via a global `[data-description]` rule — every Radix description slot.
- **Border** (`oklch(0.9325 0.0022 17.20)` light / `oklch(0.3557 0.0065 48.53)` dark):
  Applied globally to every element by default (`* { @apply border-border }`).
  In light mode it equals the card surface, so borders are nearly invisible and
  separation comes from tone and shadow, not lines.
- **Sidebar Border** (`oklch(0.8895 0.0035 17.20)` light /
  `oklch(0.4213 0.0065 48.53)` dark): one tonal step off the sidebar surface —
  unlike the app `border`, this one is meant to be faintly visible, for the
  rail's nav/crate divider and the group separators.
- **Sidebar Active** (`oklch(0.8807 0.0556 273.67)` light /
  `oklch(0.3862 0.0507 273.67)` dark) with **Sidebar Active Foreground**
  (`oklch(0.3771 0.1178 273.67)` light / `oklch(0.9137 0.0451 269.30)` dark):
  the periwinkle accent tinted onto the sidebar surface for the active-nav
  cell, paired with an ink-toned foreground that clears AA. This is the only
  place a tinted fill stands in for the accent — everywhere else periwinkle is
  full-strength and used at ≤10% of the screen.

### Destructive
- **Rose** (`oklch(0.6823 0.1365 10.37)`): Delete actions and error states only.
  The same value in both themes.

### Named Rules
**The One Voice Rule.** Periwinkle is the only accent in the system and it marks
wayfinding and primary intent — the active path, the main action, the current
selection. It should occupy roughly 10% or less of any screen. Its restraint is
what makes it read as a signal. If a screen needs a second color to make sense,
the layout is wrong, not the palette.

**The Ghost Border Rule.** In light mode, borders share the card-surface value
and all but disappear. Reach for a tonal shift or a soft shadow to separate
surfaces before you reach for a visible line.

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
the quiet stage at rest and never read as hard or directional. The shadow
vocabulary is a single diffuse recipe scaled up — a 2px/2px offset with a 10px
blur and 4px spread, at 18% opacity, warm grey in light mode
(`#a6a7ab`) and near-black in dark. There is no crisp drop shadow anywhere in
the system.

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
- **Primary:** `bg-primary` periwinkle, white text, `shadow-xs`. Hover drops to
  `bg-primary/90`. Feel: tactile and confident — a clear, pressable target.
- **Secondary:** `bg-secondary` (card surface), muted-blue text, hover
  `bg-secondary/80`.
- **Outline:** `border-input` on `bg-background`, hover fills `bg-accent` with
  `accent-foreground`.
- **Ghost:** transparent at rest, hover fills `bg-accent`. For low-emphasis
  toolbar actions.
- **Link:** periwinkle text, underline on hover.
- **Transition:** `transition-colors` only. Focus: `ring-1 ring-ring` (periwinkle).
- **Cursor:** buttons set `cursor-pointer` explicitly.

### Chips / Badges
- **Style:** Fully round (`rounded-full`), `px-2 py-0.5 text-xs font-medium`,
  transparent border.
- **Variants:** `default` (periwinkle / white), `secondary` (card surface /
  foreground), `accent` (white / accent-foreground), `outline` (foreground text,
  hover tint), `destructive` (rose / white), `foreground` (inverted: foreground
  bg / background text).
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
- **Focus:** `outline-none` + `ring-1 ring-ring` (periwinkle). No glow, just a
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
- **Active cell:** filled `bg-sidebar-active` (periwinkle tinted onto the
  sidebar surface) with `text-sidebar-active-foreground` (ink-dark, clears AA),
  plus a 3px periwinkle tick (`--sidebar-primary`) detached to the rail's left
  edge (`-left-[13px]`), vertically centred on the icon. Longest-matching-URL
  wins, so `/music/harmonic` lights Harmonic, not Music.
- **Hover / focus label:** a floating pill on the `popover` surface
  (`rounded-md`, `shadow-md`, `text-xs`) to the right of the item, via the
  shared Tooltip primitive so keyboard focus reveals it too (`RailLabel`).
- **Crate strip:** below a hairline `sidebar-border/70` divider, a vertical
  `overflow-y-auto` column of 40px `rounded-lg` playlist covers — a 2×2 mosaic
  from `stats.images`, a single image, or a periwinkle-tinted monogram tile as
  fallback. `mask-image` linear-gradient fade top and bottom, scrollbar hidden
  (`.no-scrollbar`), each cover `hover:scale-105` with its name in the same
  label pill. Clicking a cover opens that crate.
- **Ends:** the `Disc3` mark in a periwinkle `rounded-xl` tile pinned top; the
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
- **Do** keep periwinkle to wayfinding and primary intent — active nav, primary
  button, current selection, chart series — at ≤10% of a screen.
- **Do** separate surfaces with a tonal step (background → card → popover) and a
  soft `shadow-sm` before reaching for a visible border.
- **Do** use `rounded-md` for controls, `rounded-xl` for cards, `rounded-full`
  for badges and avatars. Nothing sharper than 1rem.
- **Do** design dark mode as the primary working environment and verify album
  art still reads against the warm charcoal.
- **Do** use Roboto Mono for BPM, key, duration, and file paths only.
- **Do** support horizontal scrolling rails as a real browsing pattern.
- **Do** honor `prefers-reduced-motion` — the base layer already forces near-zero
  durations; keep motion non-essential.

### Don't:
- **Don't** introduce a second accent color. If a screen seems to need one, fix
  the hierarchy instead.
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
