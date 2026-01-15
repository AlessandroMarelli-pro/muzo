import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateFilterDto,
  FilterCriteria,
  FilterOptions,
  SavedFilter,
  StaticFilterOptions,
  UpdateFilterDto,
} from '../../models/filter.model';
import { PrismaService } from '../../shared/services/prisma.service';

@Injectable()
export class FilterService {
  private currentFilter: FilterCriteria | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getStaticFilterOptions(): Promise<StaticFilterOptions> {
    // Get distinct genres from trackGenres relation
    const genres = await this.prisma.genre.findMany({
      select: {
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Get distinct subgenres from trackSubgenres relation
    const subgenres = await this.prisma.subgenre.findMany({
      select: {
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Get distinct keys from audio fingerprints
    const keyResults = await this.prisma.audioFingerprint.findMany({
      select: {
        key: true,
      },
    });

    // Get distinct libraries from music libraries
    const libraryResults = await this.prisma.musicLibrary.findMany({
      select: {
        id: true,
        name: true,
      },
    });
    // Extract and deduplicate keys
    const keys = new Set<string>();
    keyResults.forEach((fp) => {
      if (fp.key) keys.add(fp.key);
    });

    // Get distinct atmospheres from atmospheres relation
    const atmosphereResults = await this.prisma.musicTrack.findMany({
      select: {
        atmosphereDesc: true,
      },
    });

    const atmospheres = atmosphereResults
      .map((at) => JSON.parse(at.atmosphereDesc))
      .flat();
    const uniqueAtmospheres = new Set(atmospheres);
    return {
      genres: genres.map((g) => g.name),
      subgenres: subgenres.map((s) => s.name),
      keys: Array.from(keys).sort(),
      libraries: libraryResults.map((l) => ({
        id: l.id,
        name: l.name,
      })),
      atmospheres: Array.from(uniqueAtmospheres).filter((a) => a !== null),
    };
  }

  async getFilterOptions(): Promise<FilterOptions> {
    // Get audio features from audio fingerprints
    const fingerprintResults = await this.prisma.audioFingerprint.findMany({
      select: {
        tempo: true,
        speechiness: true,
        instrumentalness: true,
        liveness: true,
        acousticness: true,
      },
    });

    const tempoValues = fingerprintResults
      .filter((fp) => fp.tempo !== null)
      .map((fp) => fp.tempo!);

    const speechinessValues = fingerprintResults
      .filter((fp) => fp.speechiness !== null)
      .map((fp) => fp.speechiness!);
    const instrumentalnessValues = fingerprintResults
      .filter((fp) => fp.instrumentalness !== null)
      .map((fp) => fp.instrumentalness!);
    const livenessValues = fingerprintResults
      .filter((fp) => fp.liveness !== null)
      .map((fp) => fp.liveness!);
    const acousticnessValues = fingerprintResults
      .filter((fp) => fp.acousticness !== null)
      .map((fp) => fp.acousticness!);

    return {
      tempoRange: {
        min: tempoValues.length > 0 ? Math.min(...tempoValues) : 60,
        max: tempoValues.length > 0 ? Math.max(...tempoValues) : 200,
      },

      speechinessRange: {
        min: speechinessValues.length > 0 ? Math.min(...speechinessValues) : 0,
        max: speechinessValues.length > 0 ? Math.max(...speechinessValues) : 1,
      },
      instrumentalnessRange: {
        min:
          instrumentalnessValues.length > 0
            ? Math.min(...instrumentalnessValues)
            : 0,
        max:
          instrumentalnessValues.length > 0
            ? Math.max(...instrumentalnessValues)
            : 1,
      },
      livenessRange: {
        min: livenessValues.length > 0 ? Math.min(...livenessValues) : 0,
        max: livenessValues.length > 0 ? Math.max(...livenessValues) : 1,
      },
      acousticnessRange: {
        min:
          acousticnessValues.length > 0 ? Math.min(...acousticnessValues) : 0,
        max:
          acousticnessValues.length > 0 ? Math.max(...acousticnessValues) : 1,
      },
    };
  }

  setCurrentFilter(criteria: FilterCriteria): FilterCriteria {
    this.currentFilter = criteria;
    return this.currentFilter;
  }

  getCurrentFilter(): FilterCriteria | null {
    return this.currentFilter;
  }

  clearCurrentFilter(): void {
    this.currentFilter = null;
  }

  async createSavedFilter(dto: CreateFilterDto): Promise<SavedFilter> {
    const filter = await this.prisma.savedFilter.create({
      data: {
        name: dto.name,
        criteria: JSON.stringify(dto.criteria),
      },
    });

    return {
      id: filter.id,
      name: filter.name,
      criteria: JSON.parse(filter.criteria),
      createdAt: filter.createdAt,
      updatedAt: filter.updatedAt,
    };
  }

  async findAllSavedFilters(): Promise<SavedFilter[]> {
    const filters = await this.prisma.savedFilter.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return filters.map((filter) => ({
      id: filter.id,
      name: filter.name,
      criteria: JSON.parse(filter.criteria),
      createdAt: filter.createdAt,
      updatedAt: filter.updatedAt,
    }));
  }

  async findOneSavedFilter(id: string): Promise<SavedFilter> {
    const filter = await this.prisma.savedFilter.findUnique({
      where: { id },
    });

    if (!filter) {
      throw new NotFoundException(`Saved filter with ID ${id} not found`);
    }

    return {
      id: filter.id,
      name: filter.name,
      criteria: JSON.parse(filter.criteria),
      createdAt: filter.createdAt,
      updatedAt: filter.updatedAt,
    };
  }

  async updateSavedFilter(
    id: string,
    dto: UpdateFilterDto,
  ): Promise<SavedFilter> {
    const existingFilter = await this.prisma.savedFilter.findUnique({
      where: { id },
    });

    if (!existingFilter) {
      throw new NotFoundException(`Saved filter with ID ${id} not found`);
    }

    const updatedFilter = await this.prisma.savedFilter.update({
      where: { id },
      data: {
        name: dto.name ?? existingFilter.name,
        criteria: dto.criteria
          ? JSON.stringify(dto.criteria)
          : existingFilter.criteria,
      },
    });

    return {
      id: updatedFilter.id,
      name: updatedFilter.name,
      criteria: JSON.parse(updatedFilter.criteria),
      createdAt: updatedFilter.createdAt,
      updatedAt: updatedFilter.updatedAt,
    };
  }

  async deleteSavedFilter(id: string): Promise<void> {
    const filter = await this.prisma.savedFilter.findUnique({
      where: { id },
    });

    if (!filter) {
      throw new NotFoundException(`Saved filter with ID ${id} not found`);
    }

    await this.prisma.savedFilter.delete({
      where: { id },
    });
  }

  async buildPrismaWhereClause(
    criteria: FilterCriteria,
    skipGenres: boolean = false,
    skipSubgenres: boolean = false,
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
        // Filter tracks that have ALL specified subgenres
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
