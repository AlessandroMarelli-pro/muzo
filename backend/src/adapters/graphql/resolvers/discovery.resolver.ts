import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { DiscoverSimilarTracksForPlaylistUseCase } from 'src/application/use-cases/discovery';
import { parsePlaylistId } from '../../common/utils/parse-id';
import { Base64ID } from '../scalars/base64-id.scalar';
import { DiscoveredTrack } from '../schema/discovery.schema';

@Resolver()
export class DiscoveryResolver {
  constructor(
    private readonly discoverSimilarTracksForPlaylistUseCase: DiscoverSimilarTracksForPlaylistUseCase,
  ) {}

  @Query(() => [DiscoveredTrack])
  async discoverSimilarTracksForPlaylist(
    @Args('playlistId', { type: () => Base64ID }) playlistId: string,
    @Args('userId') userId: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<DiscoveredTrack[]> {
    const id = parsePlaylistId(playlistId);
    const results = await this.discoverSimilarTracksForPlaylistUseCase.execute(
      id,
      userId,
      limit ?? 30,
    );
    return results.map((result) => ({
      ...result,
      videoId: result.videoId ?? undefined,
    }));
  }
}
