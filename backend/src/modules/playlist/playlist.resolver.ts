import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { MusicTrackWithRelations } from 'src/models/index';
import { mapToSimpleMusicTrack } from '../music-track/music-track.resolver';
import { RecommendationService } from '../recommendation/services/recommendation.service';
import {
  CreatePlaylistInput,
  Playlist,
  PlaylistSorting,
  PlaylistTrack,
  ReorderTracksInput,
  TrackRecommendation,
  UpdatePlaylistPositionsInput,
  UpdatePlaylistSortingInput,
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

  @Mutation(() => Boolean)
  async removeTrackFromPlaylist(
    @Args('playlistId', { type: () => ID }) playlistId: string,
    @Args('trackId', { type: () => ID }) trackId: string,
    @Args('userId') userId?: string,
  ) {
    await this.playlistService.removeTrackFromPlaylist(playlistId, trackId);
    return true;
  }

  @Mutation(() => Playlist)
  async reorderPlaylistTracks(
    @Args('playlistId', { type: () => ID }) playlistId: string,
    @Args('input') input: ReorderTracksInput,
    @Args('userId') userId?: string,
  ) {
    return this.playlistService.reorderTracks(playlistId, input);
  }

  @Mutation(() => String)
  async exportPlaylistToM3U(
    @Args('playlistId', { type: () => ID }) playlistId: string,
    @Args('userId') userId?: string,
  ) {
    return this.playlistService.exportPlaylistToM3U(playlistId);
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

  @Mutation(() => PlaylistSorting)
  async updatePlaylistSorting(
    @Args('playlistId', { type: () => ID }) playlistId: string,
    @Args('input') input: UpdatePlaylistSortingInput,
    @Args('userId') userId?: string,
  ) {
    const sorting = await this.playlistService.updatePlaylistSorting(
      playlistId,
      input,
    );
    return {
      id: sorting.id,
      playlistId: sorting.playlistId,
      sortingKey: sorting.sortingKey,
      sortingDirection: sorting.sortingDirection,
      createdAt: sorting.createdAt,
      updatedAt: sorting.updatedAt,
    };
  }
}
