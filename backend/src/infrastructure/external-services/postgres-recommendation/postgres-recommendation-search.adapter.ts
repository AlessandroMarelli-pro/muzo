import { Inject, Injectable } from '@nestjs/common';
import type { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import type { RecommendationMatch } from 'src/application/ports/dtos/RecommendationMatch';
import { IRecommendationSearchPort } from 'src/application/ports/queries/IRecommendationSearchPort';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';
import { models } from 'src/kernel/types/models';
import type { RecommendationCriteria } from 'src/kernel/types/model-types';
import { buildRecommendationSql } from './recommendation-sql.builder';
import { extractRecommendationReasons } from './recommendation-reasons';

type RecommendationRow = {
  trackId: string;
  totalScore: number;
  camelotKey: string | null;
  tempo: number | null;
  valence: number | null;
  valenceMood: string | null;
  arousal: number | null;
  arousalMood: string | null;
  danceability: number | null;
  danceabilityFeeling: string | null;
  genres: string[];
  subgenres: string[];
};

/**
 * Postgres + pgvector replacement for the Elasticsearch RecommendationSearchAdapter.
 * See recommendation-sql.builder.ts for the scoring port itself.
 *
 * Both callers of this port (GetTrackRecommendationsUseCase,
 * GetPlaylistRecommendationsUseCase) discard everything on `track` except
 * `id` -- they re-fetch the full MusicTrack from Postgres by id afterwards --
 * so this adapter only needs to return a minimal track stub, not a full
 * domain mapping.
 */
@Injectable()
export class PostgresRecommendationSearchAdapter implements IRecommendationSearchPort {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  // `features` is always a single-element array -- see the ES adapter this
  // replaces for why: features[0] is the fully aggregated playlist-level
  // object, multi-seed diversity is carried inside it via features[0].embeddings.
  async searchByFeatures(
    features: AudioFeatures[],
    criteria: RecommendationCriteria,
  ): Promise<RecommendationMatch[]> {
    const playlistFeatures = features[0];
    const { sql } = buildRecommendationSql(playlistFeatures, criteria);
    const rows = await this.prisma.$queryRaw<RecommendationRow[]>(sql);

    return rows.map((row) => ({
      track: {
        id: models.musicTrack.id(row.trackId),
        artist: undefined,
        title: undefined,
        metadata: undefined,
      } as RecommendationMatch['track'],
      similarity: row.totalScore,
      reasons: extractRecommendationReasons(row, playlistFeatures),
    }));
  }
}
