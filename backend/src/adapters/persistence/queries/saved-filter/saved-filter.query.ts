import { Injectable } from '@nestjs/common';
import { groupBy } from 'lodash';
import {
  ISavedFilterQuery,
  StaticFilterOptions,
} from 'src/application/ports/queries/ISavedFilterQuery';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { getCurrentUserId, models } from 'src/kernel/types';

@Injectable()
export class SavedFilterQuery implements ISavedFilterQuery {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 
   * @returns subgenres_options AS (
        SELECT id, name FROM subgenres
      ),
      keys_options AS (
        SELECT DISTINCT key FROM audio_fingerprints WHERE key IS NOT NULL AND key != ''
      ),
      libraries_options AS (
        SELECT id, name FROM music_libraries
      ),
      atmospheres_options AS (
        SELECT DISTINCT atmosphereDesc FROM music_tracks WHERE atmosphereDesc IS NOT NULL AND atmosphereDesc != ''
      )
      SELECT id, name FROM genres_options
      UNION ALL
      SELECT id, name FROM subgenres_options
      UNION ALL
      SELECT DISTINCT key FROM keys_options
      UNION ALL
      SELECT id, name FROM libraries_options
      UNION ALL
      SELECT DISTINCT atmosphereDesc FROM atmospheres_options
   */
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
        SELECT atmosphereDesc as id, atmosphereDesc as name, 'atmospheres' as type FROM music_tracks as atmospheres WHERE createdById = ${getCurrentUserId()}
    `.then((result) => {
      const groups = groupBy(result, 'type');

      return {
        genres: groups.genres.map((group) => ({
          id: models.genre.id(group.id),
          name: group.name,
        })),
        subgenres: groups.subgenres.map((group) => ({
          id: models.subgenre.id(group.id),
          name: group.name,
        })),
        keys: groups.keys.map((group) => ({ id: group.id, name: group.name })),
        libraries: groups.libraries.map((group) => ({
          id: models.library.id(group.id),
          name: group.name,
        })),
        atmospheres: groups.atmospheres.map((group) => ({
          id: group.id,
          name: group.name,
        })),
      };
    });
  }
}
