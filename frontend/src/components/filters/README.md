# Unified Filter System

A comprehensive filtering system for the Muzo music application that provides both **UI state management** and **server persistence** in a single, unified interface. Users can filter tracks by various criteria including genres, subgenres, musical keys, tempo, energy, danceability, and valence.

## Architecture

The filter system has been **consolidated** into a single, clean architecture:

- **`useFiltering`** - Core hook that manages both UI state and server persistence
- **`FilterProvider`** - Context provider that wraps the unified hook
- **`useFilters`** - Context hook for components to access filter state and actions

## Components

### FilterProvider

The main context provider that manages filter state across the application.

```tsx
import { FilterProvider } from '@/contexts/filter-context';

function App() {
  return <FilterProvider>{/* Your app components */}</FilterProvider>;
}
```

### FilterSheet

A sheet component that contains all filter controls with automatic server persistence.

```tsx
import { FilterSheet } from '@/components/filters';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return <FilterSheet open={isOpen} onOpenChange={setIsOpen} />;
}
```

### FilterButton

A button component that opens the filter sheet and shows active filter status.

```tsx
import { FilterButton } from '@/components/filters';

function MyComponent() {
  return <FilterButton className="my-custom-class" />;
}
```

## Hooks

### useFilters (Recommended)

Access filter state and actions through the unified context.

```tsx
import { useFilters } from '@/contexts/filter-context';

function MyComponent() {
  const {
    filters,
    updateFilter,
    resetFilters,
    hasActiveFilters,
    saveCurrentFilter,
    loadSavedFilter,
    clearSavedFilter,
    isLoading,
    error,
  } = useFilters();

  // Use filter state and actions
}
```

### useFiltering (Advanced)

Direct access to the core filtering hook for advanced use cases.

```tsx
import { useFiltering } from '@/hooks/useFiltering';

function MyComponent() {
  const filtering = useFiltering();

  // Access raw state and mutations
  const { filters, savedFilter, actions, mutations } = filtering;
}
```

### useFilterOptions

Access filter options data.

```tsx
import { useFilterOptions } from '@/contexts/filter-context';

function MyComponent() {
  const { options, setOptions } = useFilterOptions();

  // Use options data
}
```

### useFilterOptionsData

Fetch and manage filter options from API.

```tsx
import { useFilterOptionsData } from '@/hooks/useFilterOptions';

function MyComponent() {
  const { isLoading, genres, subgenres, keys } = useFilterOptionsData();

  // Use fetched data
}
```

## Filter Types

### FilterState

```tsx
interface FilterState {
  genres: string[]; // Selected genre values
  subgenres: string[]; // Selected subgenre values
  keys: string[]; // Selected musical key values
  tempo: Range; // Tempo range {min, max} in BPM
  energy: Range; // Energy range {min, max} 0-1
  danceability: Range; // Danceability range {min, max} 0-1
  valence: Range; // Valence range {min, max} 0-1
  speechiness: Range; // Speechiness range {min, max} 0-1
  instrumentalness: Range; // Instrumentalness range {min, max} 0-1
  liveness: Range; // Liveness range {min, max} 0-1
  acousticness: Range; // Acousticness range {min, max} 0-1
}
```

### FilterOptions

```tsx
interface FilterOptions {
  genres: { label: string; value: string }[];
  subgenres: { label: string; value: string }[];
  keys: { label: string; value: string }[];
}
```

## Usage Examples

### Basic Setup

```tsx
import { FilterProvider } from '@/contexts/filter-context';
import { FilterButton } from '@/components/filters';
import { useFilterOptionsData } from '@/hooks/useFilterOptions';

function App() {
  return (
    <FilterProvider>
      <MusicLibrary />
    </FilterProvider>
  );
}

function MusicLibrary() {
  useFilterOptionsData(); // Load filter options

  return (
    <div>
      <div className="flex justify-between items-center">
        <h1>Music Library</h1>
        <FilterButton />
      </div>
      {/* Your music tracks */}
    </div>
  );
}
```

### Custom Filter Integration

```tsx
import { useFilters } from '@/contexts/filter-context';

function TrackList() {
  const { filters, isLoading } = useFilters();

  // Apply filters to your track query
  const filteredTracks = useQuery({
    queryKey: ['tracks', filters],
    queryFn: () => fetchTracks(filters),
    enabled: !isLoading, // Wait for filters to load
  });

  return (
    <div>
      {filteredTracks.data?.map((track) => (
        <TrackCard key={track.id} track={track} />
      ))}
    </div>
  );
}
```

### Programmatic Filter Updates

```tsx
import { useFilters } from '@/contexts/filter-context';

function QuickFilterButtons() {
  const { updateFilter, saveCurrentFilter } = useFilters();

  const handleQuickFilter = (type: string, value: any) => {
    updateFilter(type, value);
    saveCurrentFilter(); // Auto-save the filter
  };

  return (
    <div className="flex gap-2">
      <Button onClick={() => handleQuickFilter('genres', ['electronic'])}>
        Electronic Only
      </Button>
      <Button
        onClick={() => handleQuickFilter('tempo', { min: 120, max: 140 })}
      >
        Dance Tempo
      </Button>
    </div>
  );
}
```

### Server Persistence

```tsx
import { useFilters } from '@/contexts/filter-context';

function FilterManager() {
  const { loadSavedFilter, saveCurrentFilter, clearSavedFilter, isLoading } =
    useFilters();

  return (
    <div className="flex gap-2">
      <Button onClick={loadSavedFilter} disabled={isLoading}>
        Load Saved Filter
      </Button>
      <Button onClick={() => saveCurrentFilter('My Custom Filter')}>
        Save Current Filter
      </Button>
      <Button onClick={clearSavedFilter} variant="destructive">
        Clear Saved Filter
      </Button>
    </div>
  );
}
```

## Key Benefits

### ✅ **Unified Interface**

- Single hook (`useFilters`) for all filter operations
- No more confusion between `useFilters` and `useFilter`
- Consistent API across all components

### ✅ **Automatic Persistence**

- Filters are automatically saved to the server
- Loading states handled transparently
- Error handling built-in

### ✅ **Performance Optimized**

- UI updates are immediate (no server round-trips)
- Server persistence happens in the background
- Efficient state management with React hooks

### ✅ **Type Safe**

- Full TypeScript support
- Compile-time validation of filter operations
- IntelliSense support for all filter properties

## Migration Guide

### Before (Old System)

```tsx
// ❌ Old way - confusing dual hooks
const { filters, updateFilter } = useFilters(); // UI state
const { actions, state } = useFilter(); // Server state

// Manual synchronization required
useEffect(() => {
  if (state.value) {
    const savedData = JSON.parse(state.value);
    // Manually apply each filter...
  }
}, [state.value]);
```

### After (New System)

```tsx
// ✅ New way - single unified hook
const { filters, updateFilter, loadSavedFilter, saveCurrentFilter } =
  useFilters();

// Automatic synchronization
useEffect(() => {
  loadSavedFilter(); // Loads and applies automatically
}, []);
```

## Error Handling

The unified system provides comprehensive error handling:

```tsx
function FilterComponent() {
  const { error, isLoading } = useFilters();

  if (error) {
    return <div>Error loading filters: {error.message}</div>;
  }

  if (isLoading) {
    return <div>Loading filters...</div>;
  }

  return <div>Filter controls...</div>;
}
```
