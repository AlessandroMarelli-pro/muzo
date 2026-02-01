import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { RecommendationService } from '../recommendation/services/recommendation.service';
import {
  CreatePlaylistInput,
  Playlist,
  TrackRecommendation,
} from './playlist.model';
import { PlaylistService } from './playlist.service';

@Resolver('Playlist')
export class PlaylistResolver {
  constructor(
    private readonly playlistService: PlaylistService,
    private readonly recommendationService: RecommendationService,
  ) {}

  @Query(() => [TrackRecommendation])
  async playlistRecommendations(
    @Args('playlistId', { type: () => ID }) playlistId: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('excludeTrackIds', { type: () => [String], nullable: true })
    excludeTrackIds?: string[],
  ) {
    return this.recommendationService.getPlaylistRecommendations({
      playlistId,
      limit,
      excludeTrackIds,
    });
  }

  @Mutation(() => Playlist)
  async createPlaylist(@Args('input') input: CreatePlaylistInput) {
    return this.playlistService.createPlaylist(input);
  }
}
