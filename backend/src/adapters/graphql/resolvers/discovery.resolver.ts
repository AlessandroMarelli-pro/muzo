import { Args, Query, Resolver } from '@nestjs/graphql';
import {
  DiscoverSimilarTracksForPlaylistUseCase,
  GetCosineRecommendationsForTrackUseCase,
} from 'src/application/use-cases/discovery';
import { parseMusicTrackId, parsePlaylistId } from '../../common/utils/parse-id';
import { Base64ID } from '../scalars/base64-id.scalar';
import { CosineRecommendedTrack, DiscoveredTrack } from '../schema/discovery.schema';

@Resolver()
export class DiscoveryResolver {
  constructor(
    private readonly discoverSimilarTracksForPlaylistUseCase: DiscoverSimilarTracksForPlaylistUseCase,
    private readonly getCosineRecommendationsForTrackUseCase: GetCosineRecommendationsForTrackUseCase,
  ) {}

  @Query(() => [DiscoveredTrack])
  async discoverSimilarTracksForPlaylist(
    @Args('playlistId', { type: () => Base64ID }) playlistId: string,
    @Args('userId') userId: string,
  ): Promise<DiscoveredTrack[]> {
    const id = parsePlaylistId(playlistId);
    const results = await this.discoverSimilarTracksForPlaylistUseCase.execute(id, userId);
    return results.map((result) => ({
      ...result,
      videoId: result.videoId ?? undefined,
    }));
  }

  @Query(() => [CosineRecommendedTrack])
  async cosineRecommendationsForTrack(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
    @Args('userId', { nullable: true }) userId?: string,
  ): Promise<CosineRecommendedTrack[]> {
    const id = parseMusicTrackId(trackId);
    const results = await this.getCosineRecommendationsForTrackUseCase.execute(
      id,
      userId ?? 'default',
    );
    return results.map((result) => ({
      artist: result.artist,
      title: result.title,
      score: result.score,
      externalLink: result.externalLink,
      videoId: result.videoId,
    }));
  }
}
