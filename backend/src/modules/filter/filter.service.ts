import { Injectable } from '@nestjs/common';
import { FilterCriteria } from '../../models/filter.model';
import { PrismaService } from '../../shared/services/prisma.service';

@Injectable()
export class FilterService {
  private currentFilter: FilterCriteria | null = null;

  constructor(private readonly prisma: PrismaService) {}

  getCurrentFilter(): FilterCriteria | null {
    return this.currentFilter;
  }

  async buildPrismaWhereClause(
    criteria: FilterCriteria,
    skipGenres: boolean = false,
    skipSubgenres: boolean = false,
    subgenreSelectionMode: 'exact' | 'contain' = 'exact',
  ) {
    const where: any = {};

    if (criteria.genres && criteria.genres.length > 0 && !skipGenres) {
      // Find genre IDs from genre names
      const genreRecords = await this.prisma.genre.findMany({
        where: {
          name: { in: criteria.genres },
        },
        select: {
          id: true,
        },
      });
      const genreIds = genreRecords.map((g) => g.id);

      if (genreIds.length > 0) {
        where.trackGenres = {
          some: {
            genreId: { in: genreIds },
          },
        };
      }
    }

    if (criteria.subgenres && criteria.subgenres.length > 0 && !skipSubgenres) {
      // Find subgenre IDs from subgenre names
      const subgenreRecords = await this.prisma.subgenre.findMany({
        where: {
          name: { in: criteria.subgenres },
        },
        select: {
          id: true,
        },
      });
      const subgenreIds = subgenreRecords.map((s) => s.id);

      if (subgenreIds.length > 0) {
        if (subgenreSelectionMode === 'contain') {
          // Filter tracks that have ANY of the specified subgenres (OR logic)
          where.trackSubgenres = {
            some: {
              subgenreId: { in: subgenreIds },
            },
          };
        } else {
          // Filter tracks that have ALL specified subgenres (AND logic - exact mode)
          // Use AND at the where level to ensure each subgenre is present
          // Each condition checks that the track has at least one trackSubgenre with the specific subgenreId
          const subgenreConditions = subgenreIds.map((subgenreId) => ({
            trackSubgenres: {
              some: {
                subgenreId: subgenreId,
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
    }

    if (
      criteria.artist ||
      criteria.title ||
      criteria.keys ||
      criteria.tempo?.min !== 0 ||
      criteria.tempo?.max !== 200 ||
      criteria.valenceMood ||
      criteria.arousalMood ||
      criteria.danceabilityFeeling ||
      criteria.speechiness?.min !== 0 ||
      criteria.speechiness?.max !== 1 ||
      criteria.instrumentalness?.min !== 0 ||
      criteria.instrumentalness?.max !== 1 ||
      criteria.liveness?.min !== 0 ||
      criteria.liveness?.max !== 1 ||
      criteria.acousticness?.min !== 0 ||
      criteria.acousticness?.max !== 1
    ) {
      const fingerprintWhere: any = {};

      if (criteria.artist && criteria.artist.length > 0) {
        where.OR = [
          { originalArtist: { contains: criteria.artist } },
          { userArtist: { contains: criteria.artist } },
        ];
      }

      if (criteria.title && criteria.title.length > 0) {
        where.OR = [
          { originalTitle: { contains: criteria.title } },
          { userTitle: { contains: criteria.title } },
        ];
      }

      if (criteria.keys && criteria.keys.length > 0) {
        fingerprintWhere.key = { in: criteria.keys };
      }

      if (criteria.valenceMood && criteria.valenceMood?.length > 0) {
        fingerprintWhere.valenceMood = { in: criteria.valenceMood };
      }

      if (criteria.arousalMood && criteria.arousalMood?.length > 0) {
        fingerprintWhere.arousalMood = { in: criteria.arousalMood };
      }

      if (
        criteria.danceabilityFeeling &&
        criteria.danceabilityFeeling?.length > 0
      ) {
        fingerprintWhere.danceabilityFeeling = {
          in: criteria.danceabilityFeeling,
        };
      }

      if (
        criteria.tempo &&
        (criteria.tempo?.min !== 0 || criteria.tempo?.max !== 200)
      ) {
        fingerprintWhere.tempo = {};
        if (criteria.tempo.min !== undefined && criteria.tempo.max !== 200) {
          fingerprintWhere.tempo.gte = criteria.tempo.min;
        }
        if (criteria.tempo.max !== undefined && criteria.tempo.max !== 200) {
          fingerprintWhere.tempo.lte = criteria.tempo.max;
        }
      }

      if (
        criteria.speechiness &&
        (criteria.speechiness?.min !== 0 || criteria.speechiness?.max !== 1)
      ) {
        fingerprintWhere.speechiness = {};
        if (criteria.speechiness.min !== undefined) {
          fingerprintWhere.speechiness.gte = criteria.speechiness.min;
        }
        if (criteria.speechiness.max !== undefined) {
          fingerprintWhere.speechiness.lte = criteria.speechiness.max;
        }
      }

      if (
        criteria.instrumentalness &&
        (criteria.instrumentalness?.min !== 0 ||
          criteria.instrumentalness?.max !== 1)
      ) {
        fingerprintWhere.instrumentalness = {};
        if (criteria.instrumentalness.min !== undefined) {
          fingerprintWhere.instrumentalness.gte = criteria.instrumentalness.min;
        }
        if (criteria.instrumentalness.max !== undefined) {
          fingerprintWhere.instrumentalness.lte = criteria.instrumentalness.max;
        }
      }

      if (
        criteria.liveness &&
        (criteria.liveness?.min !== 0 || criteria.liveness?.max !== 1)
      ) {
        fingerprintWhere.liveness = {};
        if (criteria.liveness.min !== undefined) {
          fingerprintWhere.liveness.gte = criteria.liveness.min;
        }
        if (criteria.liveness.max !== undefined) {
          fingerprintWhere.liveness.lte = criteria.liveness.max;
        }
      }

      if (
        criteria.acousticness &&
        (criteria.acousticness?.min !== 0 || criteria.acousticness?.max !== 1)
      ) {
        fingerprintWhere.acousticness = {};
        if (criteria.acousticness.min !== undefined) {
          fingerprintWhere.acousticness.gte = criteria.acousticness.min;
        }
        if (criteria.acousticness.max !== undefined) {
          fingerprintWhere.acousticness.lte = criteria.acousticness.max;
        }
      }
      if (criteria.libraryId && criteria.libraryId.length > 0) {
        where.libraryId = { in: criteria.libraryId };
      }

      if (criteria.atmospheres && criteria.atmospheres.length > 0) {
        where.atmosphereDesc = { contains: criteria.atmospheres.join(',') };
      }
      if (Object.keys(fingerprintWhere).length > 0) {
        where.audioFingerprint = fingerprintWhere;
      }
    }
    return where;
  }
}
