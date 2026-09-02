---
target: create library form and create playlist form
total_score: 16
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
target_identity: "file:/Users/alessandro/dev/cursor-dev/muzo/frontend/src/components/library/create-library-dialog.tsx"
target_fingerprint: "sha256:d9600ee9747133fca8078bfc6c52e9396da658c5cec6b37dec18711d03108800"
target_path: /Users/alessandro/dev/cursor-dev/muzo/frontend/src/components/library/create-library-dialog.tsx
timestamp: 2026-09-02T19-38-11Z
slug: src-components-library-create-library-dialog-tsx
---
# Critique — Create Library & Create Playlist forms

Method: dual-agent (A: design review · B: detector + static evidence). Browser inspection: unavailable (no dev server running; source-only review).

Targets:
- `src/components/library/create-library-dialog.tsx`
- `src/components/playlist/create-playlist-dialog.tsx`

Both render inside a right-side `Sheet` (drawer), not a `Dialog`.

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Submit shows "Creating…" then the sheet just vanishes. No success toast, no "scanning 4,201 files", no track count on the new playlist. |
| 2 | Match System / Real World | 2 | "Root Path" free-text; `maxFileSize` in MB; "Scan Interval (hours)" unexplained; `isPublic` (dead) is meaningless for a local self-hosted tool; "Supported Formats" shown as read-only badges reads like output, not a setting. |
| 3 | User Control and Freedom | 2 | Three concurrent ways to abort (X, Cancel far-left, Esc), no primary; no dirty-close guard — paste a long path, hit Esc, it's gone. Library `autoScan` / `includeSubdirectories` / `supportedFormats` are locked defaults. |
| 4 | Consistency and Standards | 1 | Off-token error styling (`text-red-600`, `bg-red-50`, `border-red-200`) in both files — breaks dark mode and the "one system" promise. `FieldError` (on-token, `role="alert"`) is built and imported nowhere. Footer overrides component default. Playlist has two loading UIs at different widths. Playlist dialog has no section headers; library has two. |
| 5 | Error Prevention | 2 | No path validation / existence check / picker — a typo fails only at scan time. `parseInt(...) || 100` silently rewrites Max Tracks. No dirty-guard. Unbounded number inputs (`min` only, no `max`). |
| 6 | Recognition Rather Than Recall | 2 | User must recall and hand-type an absolute filesystem path with no autocomplete or browse. Playlist filter effects described in prose, never shown. |
| 7 | Flexibility and Efficiency | 2 | No path picker, no "browse" affordance; `w-xs` (20rem) fixed-width input truncates long paths so power users can't verify a paste. No saved filter presets, no dry-run. |
| 8 | Aesthetic and Minimalist Design | 2 | Library drawer carries two `text-lg font-semibold` icon section headers over only 4 fields — over-structured. Playlist auto-filter dumps 6 controls + an outline info card + a switch into one flat stack. `grid gap-2` wrapping a single `Field` is dead nesting. |
| 9 | Error Recovery | 1 | Playlist mutation failure is `console.error` ONLY — user sees nothing, sheet stays open unchanged. Library renders an inline error but in off-token red. Disabled submit gives no reason. |
| 10 | Help and Documentation | 1 | No hint on Root Path (format? trailing slash? network drives?), no explanation of scan-interval tradeoffs, no docs link. The playlist "Auto-filter" info card is the only helper text anywhere and it's generic. |
| **Total** | | **16/40** | **Poor — major UX work required before this is trustworthy** |

Most real interfaces land 20–32. These forms sit below that because two core actions can fail or succeed with no feedback, and the product's single most important input (the music folder path) is a truncated free-text box.

---

## Design Specificity Verdict

**LLM assessment (A):** Category-interchangeable, with a thin coat of domain vocabulary. Both forms are generic shadcn scaffolding — `Sheet` + `grid gap-4 py-4` + `Field orientation="horizontal"` + default `Input`s — that could belong to any SaaS "create resource" flow. Nothing expresses "The Crate Room": no warm surface treatment, no periwinkle wayfinding beyond the default button token, no crate/deck metaphor, no acknowledgement that the user is pointing an AI at a 50,000-file local collection. The playlist auto-filter (build a playlist from genre/BPM/library predicates) is the only genuinely Muzo-specific idea, and it's buried in a ghost-button collapsible with zero feedback about what it matches. The library form actively fights the domain: it hides the decisions a crate-digger cares about (scan cadence, subdirectory recursion, formats) and surfaces `maxFileSize` in megabytes, which nobody organizing FLAC libraries thinks in.

**Deterministic scan (B):** `detect.mjs --json` returned `[]`, exit 0 — clean. The detector has no rule for raw color utilities, missing `role="alert"`, dead state, or broken `htmlFor` targets, so a clean exit here means little. Static token scan found **7 raw-color violations**: `create-library-dialog.tsx` lines 147, 172, 201, 230, 236, 237 (`text-red-600`, `bg-red-50 border border-red-200`), and `create-playlist-dialog.tsx` line 163 (`text-red-600`). Expected: `text-destructive`, `bg-destructive/10`. `w-xs` is **not** a violation (valid Tailwind v4 container-scale utility = 20rem) — but 20rem fixed width is still a design problem for the path field. `sm:max-w-[Npx]` on the sheets is the standard shadcn idiom, low priority.

**Visual overlays:** none — no dev server was running and starting one is not warranted for a source-level critique. No user-visible overlay is available this run.

---

## Overall Impression

The bones are conventional and mostly fine; the failures are at the two moments that matter most. Creating a library kicks off a scan of potentially tens of thousands of files and tells the user **nothing** — the drawer just closes. Creating a playlist that fails tells the user **nothing** — the drawer just sits there, button re-enabled, inviting a duplicate. And the field that the entire product depends on — the path to your music — is a 320px free-text box with no picker, no validation, and truncation that hides what you pasted.

The single biggest opportunity: treat "Create" as the **start** of a flow, not the finish. Creating a library should land you in a scan-progress view. Creating a filtered playlist should show "~48 tracks match" before you commit and "42 tracks added" after.

---

## What's Working

1. **Focus management on validation error.** Both forms call `document.getElementById(firstErrorField)?.focus()` after a failed submit (library:81, playlist:54), and the messages are actionable full sentences ("Root path is required. Enter the folder path where your music is stored.") with `role="alert"` and `aria-describedby` on the name/path inputs. All the focus-target ids match (B verified).
2. **Progressive disclosure of the playlist filter builder.** Putting the whole auto-filter apparatus behind an opt-in collapsible labelled "(Optional)" correctly signals that a playlist is just name + description by default. The conditional subgenre-mode switch (shown only once subgenres are picked, playlist:231) is the right instinct, and its label + `aria-label` wiring is correct.
3. **Pending-state lockout.** `handleOpenChange` refuses to close the sheet while the mutation is in flight (library:105, playlist:112), so the user can't orphan a half-created resource.

---

## Priority Issues

### [P0] Playlist creation failure is completely silent
- **Why it matters:** `catch (error) { console.error(...) }` (playlist:104–106) with no user-facing error state; `finally` clears `isCreating`, so the button re-enables and the sheet looks identical to before submit. The user cannot tell success from failure — they re-click and create duplicate playlists, or assume success and navigate away. Trust-destroying on a core action.
- **Fix:** Add an error banner using the `destructive` token (mirror the library dialog's block, but on-token) or a toast. Surface `error.message`. Keep the sheet open with values intact (it already does) and move focus to the banner. Wire `role="alert"` / `aria-live`.
- **Suggested command:** `$impeccable harden`

### [P0] No success feedback on either form
- **Why it matters:** Both forms close the sheet on success and do nothing else (library:97, playlist `onSuccess()`:103). The library kicks off a background scan of tens of thousands of files with zero acknowledgement. The user doesn't know the library exists, is scanning, or how to watch progress. The playlist's one potential delight — "your filter caught 42 tracks" — never happens.
- **Fix:** Fire a toast — "Library 'X' created — scanning 4,201 files" linking to the scan-progress view; "Playlist 'X' created with 42 tracks" (needs the mutation to return a count). Better: route to the new resource instead of just closing.
- **Suggested command:** `$impeccable onboard` (the create → first-value flow), then `$impeccable harden`

### [P1] Root Path is unfit for purpose
- **Why it matters:** `<Input className="w-xs">` (library:165) for an absolute filesystem path the user types or pastes from a file manager. 20rem truncates `/Users/alessandro/Music/DJ/Crates/2024/House` well before the end; no browse button; validation only checks non-empty (library:59). This is the most important and highest-error-risk field in the product, and a truncated unverifiable path fails silently at scan time with an empty library.
- **Fix:** Add a directory picker (`<input type="file" webkitdirectory>` or the platform dialog). Make the field full-width — `orientation="vertical"` for this one field, or drop `w-xs`. Echo the resolved path below in `font-mono text-muted-foreground`. Validate existence before enabling submit if the runtime allows.
- **Suggested command:** `$impeccable shape` (the field needs a rethink, not a restyle)

### [P1] Off-token error / alert styling in both dialogs
- **Why it matters:** `text-red-600` (library:147, 172, 201, 230, 237; playlist:163), `bg-red-50 border-red-200` (library:236). Explicitly forbidden by the design system. In dark mode `bg-red-50` is a near-white rectangle — blinding on the charcoal sheet. The codebase already ships `FieldError` (field.tsx:177, uses `text-destructive`, `role="alert"`) and it is imported nowhere.
- **Fix:** Replace all with `text-destructive` for messages and `bg-destructive/10 border-destructive/20 text-destructive` for the block — or adopt `<FieldError>` / a shared `<Alert variant="destructive">`. Also add the missing `role="alert"`, `id`, `aria-invalid`, and `aria-describedby` on the `scanInterval` / `maxFileSize` / `maxTracks` error paths (B: currently only name/path/playlist-name are wired).
- **Suggested command:** `$impeccable clarify` (error copy + wiring) or fold into `$impeccable harden`

### [P1] MultiSelect labels point at nothing (playlist filters)
- **Why it matters:** `FieldLabel htmlFor="genres-filter"` / `"subgenres-filter"` / `"libraries-filter"` (playlist:204, 218, 258), but `MultiSelect` (`src/components/ui/multi-select.tsx`) renders no element with any `id` — the trigger is a `<div role="combobox">` with no `id`, no `aria-labelledby`, no `aria-controls`, and the listbox is not `role="listbox"`. Clicking the label does nothing; the combobox has no accessible name; keyboard users can open it but not arrow-navigate the options. Fails WCAG 2.1 AA (4.1.2 Name/Role/Value).
- **Fix:** Add an `id` / `aria-labelledby` prop to the shared `MultiSelect` and wire `aria-controls` to the popover list; mark the list `role="listbox"` and options `role="option"`. Fix in the component, not just the dialog.
- **Suggested command:** `$impeccable harden` (scope includes the shared component)

### [P2] Library form hides its three most domain-relevant settings as uneditable defaults
- **Why it matters:** `autoScan: true`, `includeSubdirectories: true`, `supportedFormats: [...]` live in state (library:35–38) with no controls. `scanInterval` renders only `if (formData.autoScan)` — always true, never toggleable, so the "disclosure" is just a permanently-visible field. "Supported Formats" is a row of read-only `Badge`s. A crate-digger wants to control recursion, scan cadence (a 100k library shouldn't re-scan every 24h), and formats. Advertising a setting as an immutable badge is worse than hiding it.
- **Fix:** Add a `Switch` for Auto-scan (which then genuinely discloses Scan Interval), a `Switch` for Include subdirectories, and make Supported Formats an editable checkbox group. If they are truly fixed for v1, remove the badge row.
- **Suggested command:** `$impeccable shape`

---

## Persona Red Flags

**Jordan (first-timer):** Opens Create Library, types a name, sees a greyed-out "Create Library" button, clicks it — nothing (disabled, and validation only runs on a real submit). No error, no hint that Root Path below is required. They've never seen "root path" phrasing and there's no picker to teach them. They give up, or type "Music" and get an empty library after a silent scan failure. First run of the product, dead end.

**Alex (power user):** Pastes `/Volumes/CRATES/Serato/_Techno/2019-2023/Peak-Time` into Root Path; the `w-xs` field shows `…19/Peak-Tim` — can't confirm the paste. Wants auto-scan every 6h for this fast-changing crate: no control. Wants to exclude AAC/M4A rips: formats are locked badges. Builds a playlist with BPM 124–130 across 3 libraries, hits Create with no idea whether that's 12 tracks or 1,200 — no preview, no count, no dry-run.

**Sam (a11y):** In dark mode a validation error paints `bg-red-50` (near-white) — a jarring light rectangle on the charcoal sheet. `SheetHeader` is `text-center` on mobile, so visual alignment diverges from every other form. The MultiSelect trigger is a `div[role="combobox"]` with `tabIndex={0}` but no `aria-controls` / `aria-activedescendant` and no listbox semantics — openable by keyboard, not operable. `scanInterval` / `maxFileSize` error `<p>` elements (library:201, 230) have no `id`, no `aria-describedby` link, no `role="alert"`. The playlist loading sheet (playlist:121–129) has no `SheetTitle`, so the dialog has no accessible name while `options` load.

---

## Minor Observations

- `SheetTitle` and the section `<h3>`s are both `text-lg font-semibold` (sheet.tsx:100) — no type-scale differentiation between page title and section header.
- `grid gap-2` wrapping a single `<Field>` (library:129, 153) — dead nesting; the gap never applies.
- `FieldError` (field.tsx) is fully built, on-token, `role="alert"` — imported by neither form.
- Playlist loading state renders `<Loading />` in a 425px sheet, then the form in a 500px sheet — the drawer visibly jumps ~75px wider when `options` resolve.
- `maxTracks` via `parseInt(...) || 100` (playlist:291): clearing the field or typing "0" snaps to 100 — the user can't express "no limit" even though the submit logic supports `maxTracks > 0 ? … : undefined`. Library's number inputs use `|| 0` — inconsistent.
- Library dialog does **not** reset `formData` / `errors` after success (playlist does) — reopening shows the previous name and path.
- Footer `flex flex-row justify-between` puts Cancel at the far-left edge and Create at the far-right of a 500–600px drawer — a lot of mouse travel and the eye hunts for the primary action. A right-aligned pair or the component default scans better.
- `isPublic` state + `setIsPublic` (playlist:35, 95) is entirely dead — passed to the API (playlist:85), never settable. Wire a control or delete it; "public" is dubious for a local self-hosted tool.
- `as any` cast on the `createPlaylist` payload (playlist:89) — type-safety hole around `subgenreSelectionMode`.
- The `Item variant="outline"` info card inside the already-bordered, `bg-muted` collapsible is border-on-tinted-bg nesting for one sentence — `FieldDescription` would be lighter.
- Both forms `console.error` on catch — leaks to the production console.

---

## Questions to Consider

1. **If the library scan is the actual product moment, why does this form treat "Create" as the finish line?** Should creating a library route straight into a scan-progress view — making the form a step in a flow rather than a terminal drawer?
2. **What is the auto-filter worth if it never tells you what it caught?** Every query tool shows a result count before you commit. Would a live "~48 tracks match" counter make this the form's peak moment instead of its weakest?
3. **Who decided a crate-digger can't choose their own file formats or scan cadence — and shows them the formats anyway as un-editable badges?** Considered v1 scope cut, or unfinished? If it's scope, why advertise the setting at all?
