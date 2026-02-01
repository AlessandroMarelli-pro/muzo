import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { MusicTrackWithRelations } from 'src/models/index';
import { mapToSimpleMusicTrack } from '../music-track/music-track.resolver';
import { RecommendationService } from '../recommendation/services/recommendation.service';
import {
  CreatePlaylistInput,
  Playlist,
  PlaylistTrack,
  TrackRecommendation,
  UpdatePlaylistPositionsInput,
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

  @Mutation(() => [PlaylistTrack])
  async updatePlaylistPositions(
    @Args('playlistId', { type: () => ID }) playlistId: string,
    @Args('input') input: UpdatePlaylistPositionsInput,
    @Args('userId') userId?: string,
  ) {
    const playlistTracks = await this.playlistService.updatePlaylistPositions(
      playlistId,
      input.positions,
    );
    return playlistTracks.map((playlistTrack) => ({
      id: playlistTrack.id,
      position: playlistTrack.position,
      addedAt: playlistTrack.addedAt.toISOString(),
      track: mapToSimpleMusicTrack(
        playlistTrack.track as MusicTrackWithRelations,
      ),
    }));
  }
}
