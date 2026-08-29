import { Maybe } from 'src/kernel/common';
import { extractModelId } from 'src/kernel/ids/factory';
import { FilterCriteria } from 'src/kernel/types/model-types';

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

  if (
    criteria.artist ||
    criteria.title ||
    criteria.keyIds ||
    criteria.tempo?.min !== 0 ||
    criteria.tempo?.max !== 200 ||
    criteria.valenceMood ||
    criteria.arousalMood ||
    criteria.danceabilityFeeling ||
    criteria.instrumentalness?.min !== 0 ||
    criteria.instrumentalness?.max !== 1
  ) {
    const fingerprintWhere: any = {};

    if (criteria.artist && criteria.artist.length > 0) {
      where.originalArtist = { contains: criteria.artist };
    }

    if (criteria.title && criteria.title.length > 0) {
      where.originalTitle = { contains: criteria.title };
    }

    if (criteria.keyIds && criteria.keyIds.length > 0) {
      fingerprintWhere.key = { in: criteria.keyIds };
    }

    if (criteria.valenceMood && criteria.valenceMood?.length > 0) {
      fingerprintWhere.valenceMood = { in: criteria.valenceMood };
    }

    if (criteria.arousalMood && criteria.arousalMood?.length > 0) {
      fingerprintWhere.arousalMood = { in: criteria.arousalMood };
    }

    if (criteria.danceabilityFeeling && criteria.danceabilityFeeling?.length > 0) {
      fingerprintWhere.danceabilityFeeling = {
        in: criteria.danceabilityFeeling,
      };
    }

    if (criteria.tempo && (criteria.tempo?.min !== 0 || criteria.tempo?.max !== 200)) {
      fingerprintWhere.tempo = {};
      if (criteria.tempo.min !== undefined && criteria.tempo.min !== 200) {
        fingerprintWhere.tempo.gte = criteria.tempo.min;
      }
      if (criteria.tempo.max !== undefined && criteria.tempo.max !== 200) {
        fingerprintWhere.tempo.lte = criteria.tempo.max;
      }
    }

    if (
      criteria.instrumentalness &&
      (criteria.instrumentalness?.min !== 0 || criteria.instrumentalness?.max !== 1)
    ) {
      fingerprintWhere.instrumentalness = {};
      if (criteria.instrumentalness.min !== undefined) {
        fingerprintWhere.instrumentalness.gte = criteria.instrumentalness.min;
      }
      if (criteria.instrumentalness.max !== undefined) {
        fingerprintWhere.instrumentalness.lte = criteria.instrumentalness.max;
      }
    }

    if (criteria.libraryIds && criteria.libraryIds.length > 0) {
      where.libraryId = {
        in: criteria.libraryIds.map((id) => extractModelId(id).dbId),
      };
    }

    if (Object.keys(fingerprintWhere).length > 0) {
      where.audioFingerprint = fingerprintWhere;
    }
  }

  return where;
};
