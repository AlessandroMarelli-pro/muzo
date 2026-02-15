import { Injectable, Inject } from '@nestjs/common';
import { groupBy } from 'lodash';
import {
  ISavedFilterQuery,
  StaticFilterOptions,
} from 'src/application/ports/queries/ISavedFilterQuery';
import {
  PRISMA_SERVICE,
  PrismaService,
} from 'src/infrastructure/database/prisma.service';
import { getCurrentUserId, models } from 'src/kernel/types';

@Injectable()
export class SavedFilterQuery implements ISavedFilterQuery {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
  ) {}

  async getStaticFilterOptions(): Promise<StaticFilterOptions> {
    return this.prisma.$queryRaw<
      {
        id: string;
        name: string;
        type: keyof StaticFilterOptions;
      }[]
    >`
        SELECT id, name, 'genres' as type FROM genres as genres WHERE createdById = ${getCurrentUserId()}
        UNION ALL
        SELECT id, name, 'subgenres' as type FROM subgenres as subgenres WHERE createdById = ${getCurrentUserId()}
        UNION ALL
        SELECT DISTINCT key as id, key as name, 'keys' as type FROM audio_fingerprints as keys WHERE createdById = ${getCurrentUserId()}
        UNION ALL
        SELECT id, name, 'libraries' as type FROM music_libraries as libraries WHERE createdById = ${getCurrentUserId()}
        UNION ALL
        SELECT id, name, 'atmospheres' as type FROM ai_atmosphere_tags as atmospheres WHERE createdById = ${getCurrentUserId()}
    `.then((result) => {
      const groups = groupBy(result, 'type');

      return {
        genres: (groups.genres ?? []).map((group) => ({
          id: models.genre.id(group.id),
          name: group.name,
        })),
        subgenres: (groups.subgenres ?? []).map((group) => ({
          id: models.subgenre.id(group.id),
          name: group.name,
        })),
        keys: (groups.keys ?? []).map((group) => ({ id: group.id, name: group.name })),
        libraries: (groups.libraries ?? []).map((group) => ({
          id: models.library.id(group.id),
          name: group.name,
        })),
        atmospheres: (groups.atmospheres ?? []).map((group) => ({
          id: models.aiAtmosphereTag.id(group.id),
          name: group.name,
        })),
      };
    });
  }
}
