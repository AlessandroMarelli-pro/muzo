# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are DJs and crate-diggers with large **local** music collections
(hundreds to tens of thousands of files) that have accumulated messy, incomplete,
or inconsistent metadata. They work at a computer, off-gig, preparing: pointing
Muzo at a music directory and using the time between sets to get the collection
into a state where tracks can actually be found and grouped.

## Product Purpose

Muzo turns a pile of local audio files into an organized, queryable library. It
scans a music directory, analyzes each track, and applies AI-generated genre /
subgenre classification and metadata, then gives the user tools to review that
work, fix what's wrong, discover tracks they'd forgotten, and assemble playlists
and crates for gigs.

Success is a library the user trusts: complete metadata, sensible genre
structure, and fast retrieval — so set preparation is curation, not archaeology.

## Positioning

Local-first AI organization. Muzo operates on the user's own files on their own
machine (self-hosted), not a streaming catalog or a cloud service. Unlike
Rekordbox or Plex, the differentiator is that an AI does the classification and
metadata work across the whole local library, and unlike cloud tagging services
there is no upload, no lock-in, and no dependence on a match existing in someone
else's database. Recommendations are computed from the user's own collection
(cached cosine similarity over track features).

## Operating Context

- Self-hosted via Docker (Dockerfile + nginx config in repo); the app runs
  against a music directory the user mounts/configures.
- Core loop: **scan → analyze → organize → build sets.** Users move between these
  fluidly but that is the through-line.
- Scanning is a long-running background job with progress; the app must show scan
  state and surface tracks that came back incomplete.
- Third-party auth for YouTube and Tidal is present (enrichment / linking).
- Real-time player sync over WebSocket (Socket.IO) — playback state is shared/live.
- `/swipe` is Tinder-style track triage: one track at a time, accept/reject to
  quickly sort tracks (e.g. into favorites/playlists) at speed.
- Track research view: per-track analysis, audio features, and cosine-similarity
  recommendations.

## Capabilities and Constraints

- Music library management: browse, create/edit/delete libraries; advanced
  filtering and sorting with URL-persisted state.
- Playlist management: create/manage playlists, drag-and-drop reordering,
  AI-powered track recommendations.
- Music player: full playback controls, real-time p5.js waveform visualization,
  beat visualizer / audio analysis, WebSocket sync.
- Data tables: faceted filtering, sorting, pagination, column visibility.
- Track research & analysis: metadata display, audio-feature visualization,
  AI insights, cosine recommendations.
- Scan pipeline: detects and flags incomplete tracks for follow-up.
- SPA: React 19, TanStack Router (file-based), TanStack Query for server state,
  React Context for audio player / filters, nuqs for URL state.
- API: GraphQL (graphql-request, codegen types) + REST; Socket.IO for real-time.
- Terminology: "library" (a collection of tracks), "crate"/"playlist",
  "incomplete track" (scanned but missing required metadata), "research" (the
  per-track analysis surface), "swipe" (rapid triage).

## Brand Commitments

Name is "Muzo". Nothing about voice, personality, or the visual identity is
fixed yet. The current look — violet/lavender primary, generous rounding
(`--radius: 1.25rem`), Plus Jakarta Sans, Shadcn "New York", light + dark
themes — is where the project landed, not a deliberate commitment, and is open
to being redesigned or replaced in later visual work.

## Evidence on Hand

- Working application with real features (see git history and `src/`).
- No testimonials, customer names, benchmarks, pricing, or press exist. Future
  work must not fabricate any of these.
- No defined brand assets beyond the current CSS token set.

## Product Principles

1. **Local and private by default.** The user's files stay on the user's
   machine; nothing depends on uploading the collection or matching an external
   catalog.
2. **The AI proposes, the user disposes.** Classification and metadata are
   generated automatically but every result is reviewable and correctable —
   the user stays the authority on their own library.
3. **Built for scale.** Interactions must stay fast and scannable at
   tens-of-thousands-of-tracks size; no flow that assumes a small library.
4. **Preparation is the job.** Optimize for the off-gig curation session —
   organizing, cleaning, discovering, set-building — not live performance.
5. **Surface the incomplete.** The library's rough edges (unscanned, incomplete,
   misclassified tracks) should be visible and actionable, never hidden.

## Accessibility & Inclusion

Target WCAG 2.1 AA across the app.
