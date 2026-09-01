import { Maybe } from 'src/kernel/common';
import { extractModelId } from 'src/kernel/ids/factory';
import { FilterCriteria } from 'src/kernel/types/model-types';

const TEMPO_MIN_DEFAULT = 0;
const TEMPO_MAX_DEFAULT = 200;
const INSTRUMENTALNESS_MIN_DEFAULT = 0;
const INSTRUMENTALNESS_MAX_DEFAULT = 1;

const isStringSet = (value: Maybe<string>): value is string =>
  typeof value === 'string' && value.length > 0;

const isArraySet = (value: Maybe<string[]>): value is string[] =>
  Array.isArray(value) && value.length > 0;

const isRangeSet = (
  range: Maybe<{ min?: number; max?: number }>,
  minDefault: number,
  maxDefault: number,
): range is { min?: number; max?: number } => {
  if (!range) return false;
  const minSet = range.min !== undefined && range.min > minDefault;
  const maxSet = range.max !== undefined && range.max < maxDefault;
  return minSet || maxSet;
};

export const buildMusicTrackFilterWhereClause = (
  criteria: Maybe<FilterCriteria>,
  subgenreSelectionMode: 'exact' | 'contain' = 'contain',
) => {
  const where: any = {};
  if (!criteria) {
    return where;
  }

  if (criteria.genreIds && criteria.genreIds.length > 0) {
    // Find genre IDs from genre names
    where.trackGenres = {
      some: {
        genreId: { in: criteria.genreIds.map((id) => extractModelId(id).dbId) },
      },
    };
  }

  if (criteria.subgenreIds && criteria.subgenreIds.length > 0) {
    const subgenreIds = criteria.subgenreIds;
    // Find subgenre IDs from subgenre names

    if (subgenreSelectionMode === 'contain') {
      // Filter tracks that have ANY of the specified subgenres (OR logic)
      where.trackSubgenres = {
        some: {
          subgenreId: { in: subgenreIds.map((id) => extractModelId(id).dbId) },
        },
      };
    } else {
      // Filter tracks that have ALL specified subgenres (AND logic - exact mode)
      // Use AND at the where level to ensure each subgenre is present
      // Each condition checks that the track has at least one trackSubgenre with the specific subgenreId
      const subgenreConditions = subgenreIds.map((id) => ({
        trackSubgenres: {
          some: {
            subgenreId: extractModelId(id).dbId,
          },
        },
      }));

      // Merge with existing AND conditions if any
      if (where.AND) {
        where.AND = [...where.AND, ...subgenreConditions];
      } else {
        where.AND = subgenreConditions;
      }
    }
  }

  // Track-level columns (not on the fingerprint relation).
  if (isStringSet(criteria.artist)) {
    where.originalArtist = { contains: criteria.artist };
  }

  if (isStringSet(criteria.title)) {
    where.originalTitle = { contains: criteria.title };
  }

  if (criteria.libraryIds && criteria.libraryIds.length > 0) {
    where.libraryId = {
      in: criteria.libraryIds.map((id) => extractModelId(id).dbId),
    };
  }

  // Fingerprint-backed criteria. `audioFingerprint` is a nullable 1-1 relation,
  // so Prisma requires the `is` wrapper to filter through it.
  const fingerprintWhere: any = {};

  if (isArraySet(criteria.keyIds)) {
    fingerprintWhere.key = { in: criteria.keyIds };
  }

  if (isArraySet(criteria.valenceMood)) {
    fingerprintWhere.valenceMood = { in: criteria.valenceMood };
  }

  if (isArraySet(criteria.arousalMood)) {
    fingerprintWhere.arousalMood = { in: criteria.arousalMood };
  }

  if (isArraySet(criteria.danceabilityFeeling)) {
    fingerprintWhere.danceabilityFeeling = { in: criteria.danceabilityFeeling };
  }

  if (isRangeSet(criteria.tempo, TEMPO_MIN_DEFAULT, TEMPO_MAX_DEFAULT)) {
    fingerprintWhere.tempo = {};
    if (criteria.tempo.min !== undefined && criteria.tempo.min > TEMPO_MIN_DEFAULT) {
      fingerprintWhere.tempo.gte = criteria.tempo.min;
    }
    if (criteria.tempo.max !== undefined && criteria.tempo.max < TEMPO_MAX_DEFAULT) {
      fingerprintWhere.tempo.lte = criteria.tempo.max;
    }
  }

  if (
    isRangeSet(
      criteria.instrumentalness,
      INSTRUMENTALNESS_MIN_DEFAULT,
      INSTRUMENTALNESS_MAX_DEFAULT,
    )
  ) {
    fingerprintWhere.instrumentalness = {};
    if (
      criteria.instrumentalness.min !== undefined &&
      criteria.instrumentalness.min > INSTRUMENTALNESS_MIN_DEFAULT
    ) {
      fingerprintWhere.instrumentalness.gte = criteria.instrumentalness.min;
    }
    if (
      criteria.instrumentalness.max !== undefined &&
      criteria.instrumentalness.max < INSTRUMENTALNESS_MAX_DEFAULT
    ) {
      fingerprintWhere.instrumentalness.lte = criteria.instrumentalness.max;
    }
  }

  if (Object.keys(fingerprintWhere).length > 0) {
    where.audioFingerprint = { is: fingerprintWhere };
  }

  return where;
};
