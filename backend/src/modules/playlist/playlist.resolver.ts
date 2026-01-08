import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  MusicTrackWithRelations,
  PlaylistWithRelations,
} from 'src/models/index';
import { mapToSimpleMusicTrack } from '../music-track/music-track.resolver';
import { RecommendationService } from '../recommendation/services/recommendation.service';
import {
  AddTrackToPlaylistInput,
  CreatePlaylistInput,
  Playlist,
  PlaylistItem,
  PlaylistStats,
  PlaylistTrack,
  ReorderTracksInput,
  TrackRecommendation,
  UpdatePlaylistInput,
} from './playlist.model';
import { PlaylistService } from './playlist.service';

@Resolver('Playlist')
export class PlaylistResolver {
  constructor(
    private readonly playlistService: PlaylistService,
    private readonly recommendationService: RecommendationService,
  ) {}

  @Query(() => [PlaylistItem])
  async playlists(@Args('userId') userId?: string) {
    const playlists = await this.playlistService.getPlaylistWithStats();
    return playlists;
  }

  private async formatPlaylist(playlist: PlaylistWithRelations) {
    const tracks = playlist.tracks.map((track) => ({
      ...track,
      track: mapToSimpleMusicTrack(track.track as MusicTrackWithRelations),
    }));
    const playlistStats = await this.playlistService.getPlaylistWithStatsById(
      playlist.id,
    );
    return {
      ...playlist,
      ...playlistStats,
      tracks,
    };
  }

  @Query(() => Playlist)
  async playlist(
    @Args('id', { type: () => ID }) id: string,
    @Args('userId') userId?: string,
  ) {
    const playlist = await this.playlistService.findPlaylistById(id);
    return this.formatPlaylist(playlist as PlaylistWithRelations);
  }

  @Query(() => Playlist)
  async playlistByName(@Args('name', { type: () => String }) name: string) {
    const playlist = await this.playlistService.findPlaylistByName(name);
    return this.formatPlaylist(playlist as PlaylistWithRelations);
  }

  @Query(() => [PlaylistTrack])
  async playlistTracks(
    @Args('playlistId', { type: () => ID }) playlistId: string,
    @Args('userId') userId?: string,
  ) {
    return this.playlistService.getPlaylistTracks(playlistId);
  }

  @Query(() => PlaylistStats)
  async playlistStats(
    @Args('playlistId', { type: () => ID }) playlistId: string,
    @Args('userId') userId?: string,
  ) {
    return this.playlistService.getPlaylistStats(playlistId);
  }

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

  @Mutation(() => Playlist)
  async updatePlaylist(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePlaylistInput,
    @Args('userId') userId?: string,
  ) {
    return this.playlistService.updatePlaylist(id, input);
  }

  @Mutation(() => Boolean)
  async deletePlaylist(
    @Args('id', { type: () => ID }) id: string,
    @Args('userId') userId?: string,
  ) {
    await this.playlistService.deletePlaylist(id);
    return true;
  }

  @Mutation(() => PlaylistTrack)
  async addTrackToPlaylist(
    @Args('playlistId', { type: () => ID }) playlistId: string,
    @Args('input') input: AddTrackToPlaylistInput,
    @Args('userId') userId?: string,
  ) {
    return this.playlistService.addTrackToPlaylist(playlistId, input);
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
}
