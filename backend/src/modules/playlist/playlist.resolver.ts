import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { Base64ID } from 'src/clean-arch/adapters/graphql/scalars/base64-id.scalar';
import { parsePlaylistId } from 'src/clean-arch/adapters/graphql/utils/parse-id';
import { extractModelId } from 'src/clean-arch/kernel/ids/factory';
import { RecommendationService } from '../recommendation/services/recommendation.service';
import { TrackRecommendation } from './playlist.model';

@Resolver('Playlist')
export class PlaylistResolver {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Query(() => [TrackRecommendation])
  async playlistRecommendations(
    @Args('playlistId', { type: () => Base64ID }) playlistId: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('excludeTrackIds', { type: () => [String], nullable: true })
    excludeTrackIds?: string[],
  ) {
    return this.recommendationService.getPlaylistRecommendations({
      playlistId: extractModelId(parsePlaylistId(playlistId)).dbId,
      limit,
      excludeTrackIds,
    });
  }
}
