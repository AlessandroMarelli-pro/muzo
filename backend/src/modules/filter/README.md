# Filter Module

The Filter Module provides comprehensive filtering capabilities for music tracks based on various criteria including genres, subgenres, keys, and audio features (energy, tempo, danceability, valence).

## Features

- **Static Filter Options**: Get available filter values from the database
- **Current Filter**: Set and retrieve the current active filter
- **Saved Filters**: Create, read, update, and delete saved filter presets
- **Prisma Integration**: Helper method to build Prisma where clauses from filter criteria

## GraphQL API

### Queries

#### `getStaticFilterOptions`

Returns all available filter options from the database.

```graphql
query GetStaticFilterOptions {
  getStaticFilterOptions {
    genres
    subgenres
    keys
    energyRange {
      min
      max
    }
    tempoRange {
      min
      max
    }
    danceabilityRange {
      min
      max
    }
    valenceRange {
      min
      max
    }
  }
}
```

#### `getCurrentFilter`

Returns the currently active filter criteria.

```graphql
query GetCurrentFilter {
  getCurrentFilter {
    genres
    subgenres
    keys
    energy {
      min
      max
    }
    tempo {
      min
      max
    }
    danceability {
      min
      max
    }
    valence {
      min
      max
    }
  }
}
```

#### `getSavedFilters`

Returns all saved filter presets.

```graphql
query GetSavedFilters {
  getSavedFilters {
    id
    name
    criteria {
      genres
      subgenres
      keys
      energy {
        min
        max
      }
      tempo {
        min
        max
      }
      danceability {
        min
        max
      }
      valence {
        min
        max
      }
    }
    createdAt
    updatedAt
  }
}
```

#### `getSavedFilter`

Returns a specific saved filter by ID.

```graphql
query GetSavedFilter($id: ID!) {
  getSavedFilter(id: $id) {
    id
    name
    criteria {
      genres
      subgenres
      keys
    }
    createdAt
    updatedAt
  }
}
```

### Mutations

#### `setCurrentFilter`

Sets the current active filter.

```graphql
mutation SetCurrentFilter($criteria: FilterCriteriaInput!) {
  setCurrentFilter(criteria: $criteria) {
    genres
    subgenres
    keys
    energy {
      min
      max
    }
    tempo {
      min
      max
    }
    danceability {
      min
      max
    }
    valence {
      min
      max
    }
  }
}
```

Example variables:

```json
{
  "criteria": {
    "genres": ["Rock", "Electronic"],
    "subgenres": ["Alternative Rock"],
    "keys": ["C", "G"],
    "energy": {
      "min": 0.5,
      "max": 1.0
    },
    "tempo": {
      "min": 120,
      "max": 140
    }
  }
}
```

#### `clearCurrentFilter`

Clears the current active filter.

```graphql
mutation ClearCurrentFilter {
  clearCurrentFilter
}
```

#### `createSavedFilter`

Creates a new saved filter preset.

```graphql
mutation CreateSavedFilter($input: CreateSavedFilterInput!) {
  createSavedFilter(input: $input) {
    id
    name
    criteria {
      genres
      subgenres
      keys
    }
    createdAt
    updatedAt
  }
}
```

Example variables:

```json
{
  "input": {
    "name": "Energetic Rock",
    "criteria": {
      "genres": ["Rock"],
      "energy": {
        "min": 0.7,
        "max": 1.0
      }
    }
  }
}
```

#### `updateSavedFilter`

Updates an existing saved filter.

```graphql
mutation UpdateSavedFilter($id: ID!, $input: UpdateSavedFilterInput!) {
  updateSavedFilter(id: $id, input: $input) {
    id
    name
    criteria {
      genres
      subgenres
    }
    updatedAt
  }
}
```

#### `deleteSavedFilter`

Deletes a saved filter.

```graphql
mutation DeleteSavedFilter($id: ID!) {
  deleteSavedFilter(id: $id)
}
```

## Service Usage

### Using FilterService in Other Modules

The `FilterService` can be injected into other services to access filter functionality:

```typescript
import { Injectable } from '@nestjs/common';
import { FilterService } from '../filter/filter.service';

@Injectable()
export class MusicTrackService {
  constructor(private readonly filterService: FilterService) {}

  async findTracksWithCurrentFilter() {
    const currentFilter = this.filterService.getCurrentFilter();

    if (!currentFilter) {
      // No filter applied, return all tracks
      return this.prisma.musicTrack.findMany();
    }

    // Build Prisma where clause from filter criteria
    const where =
      await this.filterService.buildPrismaWhereClause(currentFilter);

    return this.prisma.musicTrack.findMany({
      where,
      include: {
        audioFingerprint: true,
      },
    });
  }
}
```

### Building Prisma Where Clauses

The `buildPrismaWhereClause` method converts filter criteria into Prisma-compatible where clauses:

```typescript
const criteria: FilterCriteria = {
  genres: ['Rock', 'Electronic'],
  energy: { min: 0.5, max: 1.0 },
  tempo: { min: 120, max: 140 },
};

const where = await filterService.buildPrismaWhereClause(criteria);

// Use in Prisma query
const tracks = await prisma.musicTrack.findMany({
  where,
  include: {
    audioFingerprint: true,
  },
});
```

## Filter Criteria Structure

### FilterCriteria Interface

```typescript
interface FilterCriteria {
  genres?: string[]; // Array of genre names
  subgenres?: string[]; // Array of subgenre names
  keys?: string[]; // Array of musical keys (e.g., "C", "G#")
  energy?: {
    // Energy level range (0-1)
    min?: number;
    max?: number;
  };
  tempo?: {
    // Tempo range in BPM
    min?: number;
    max?: number;
  };
  danceability?: {
    // Danceability score (0-1)
    min?: number;
    max?: number;
  };
  valence?: {
    // Musical positiveness (0-1)
    min?: number;
    max?: number;
  };
}
```

## Database Schema

### SavedFilter Table

```prisma
model SavedFilter {
  id        String   @id @default(uuid())
  name      String
  criteria  String   // JSON string containing filter criteria
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("saved_filters")
}
```

## Integration with MusicTrackModule

To use filters in the MusicTrackModule, import the FilterModule:

```typescript
import { Module } from '@nestjs/common';
import { FilterModule } from '../filter/filter.module';
import { MusicTrackService } from './music-track.service';
import { MusicTrackResolver } from './music-track.resolver';

@Module({
  imports: [FilterModule],
  providers: [MusicTrackService, MusicTrackResolver],
  exports: [MusicTrackService],
})
export class MusicTrackModule {}
```

Then inject the FilterService:

```typescript
@Injectable()
export class MusicTrackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filterService: FilterService,
  ) {}
}
```

## Best Practices

1. **Always validate filter criteria**: Use the static filter options to validate user input
2. **Handle null filters**: Check if `getCurrentFilter()` returns null before using it
3. **Clear filters when appropriate**: Call `clearCurrentFilter()` when resetting views
4. **Use saved filters for common queries**: Encourage users to save frequently used filters
5. **Combine with pagination**: Apply filters before pagination for better performance

## Example: Complete Filter Flow

```typescript
// 1. Get available options
const options = await filterService.getStaticFilterOptions();

// 2. Set current filter based on user selection
const criteria: FilterCriteria = {
  genres: ['Rock'],
  energy: { min: 0.6, max: 1.0 },
};
filterService.setCurrentFilter(criteria);

// 3. Use filter in queries
const currentFilter = filterService.getCurrentFilter();
const where = await filterService.buildPrismaWhereClause(currentFilter);
const tracks = await prisma.musicTrack.findMany({ where });

// 4. Save filter for later use
await filterService.createSavedFilter({
  name: 'High Energy Rock',
  criteria,
});

// 5. Clear filter when done
filterService.clearCurrentFilter();
```
