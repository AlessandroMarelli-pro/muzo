# Filter System

Filtering across the app is a single shared `FilterState` (genres, subgenres,
keys, tempo, mood, library, artist/title search) held in `FilterContext` and
edited from inline, non-modal popovers docked in each screen's toolbar.

## Architecture

- **`useFiltering`** (`@/hooks/useFiltering`) — core hook managing UI state
  and debounced auto-save to the server.
- **`FilterProvider`** (`@/contexts/filter-context`) — context provider
  wrapping the hook.
- **`useFilters`** (`@/contexts/filter-context`) — the hook components use to
  read/update filter state.
- **`TrackFilterBar`** (`@/components/track/track-filter-bar`) — the shared
  toolbar: search inputs plus one popover per facet (Genre, Subgenre, BPM,
  Key, Energy, Valence, Danceability, Instrumentalness, Library). Used
  directly on the Swipe and Pending screens, and wrapped by
  **`MusicFilterBar`** (`@/components/track/music-filter-bar`) on the Music
  screen, which adds the "Needs review" toggle.

There is no filter drawer/sheet. Every facet lives in the toolbar as an
independent `Popover` — non-modal, dismissible by clicking away, so users can
adjust a filter while still looking at the track list behind it.

`FilterComponent` (`./filter-component.tsx`) is a separate, single-column
field list used only inside `AddTrackDrawer`'s already-modal "add tracks to
playlist" flow — not part of the main browsing surfaces above.

## Components

### TrackFilterBar

```tsx
import { TrackFilterBar } from '@/components/track/track-filter-bar';

function MyTrackScreen() {
  return <TrackFilterBar matchCount={total} />;
}
```

### MusicFilterBar

```tsx
import { MusicFilterBar } from '@/components/track/music-filter-bar';

function MusicScreen() {
  return (
    <MusicFilterBar
      reviewMode={reviewMode}
      pendingCount={pendingCount}
      matchCount={totalCount}
      onReviewChange={setReviewMode}
    />
  );
}
```

## Hooks

### useFilters (Recommended)

```tsx
import { useFilters } from '@/contexts/filter-context';

function MyComponent() {
  const { filters, updateFilter, updateFilters, resetFilters, hasActiveFilters } = useFilters();
}
```

### useFilterOptionsData

Fetches and populates the genre/subgenre/key/library option lists from the API.

```tsx
import { useFilterOptionsData } from '@/hooks/useFilterOptions';

function MyComponent() {
  const { isLoading, genres, subgenres, keys, libraries } = useFilterOptionsData();
}
```

## FilterState

```tsx
interface FilterState {
  genres: string[];
  subgenres: string[];
  keyIds: string[];
  library: string[];
  tempo: { min: number; max: number };
  instrumentalness: { min: number; max: number };
  artist: string;
  title: string;
  valenceMood: string[];
  arousalMood: string[];
  danceabilityFeeling: string[];
}
```
