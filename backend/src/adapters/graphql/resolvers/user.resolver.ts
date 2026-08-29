import { CursorPaginationArgs, PaginationArgs } from '../schema/pagination.args';
// user.resolver.ts
import { UseGuards } from '@nestjs/common';
import { Args, Query, ResolveField, Resolver } from '@nestjs/graphql';
import {
  GetFavoriteUseCase,
  GetPendingTracksUseCase,
  GetPlaylistsUseCase,
  GetQueueUseCase,
  GetRandomTrackIdUseCase,
  GetRecentlyPlayedUseCase,
  GetTracksWithCursorPaginationUseCase,
  GetTracksWithPaginationUseCase,
} from 'src/application/use-cases';
import {
  GetCurrentFilterUseCase,
  GetStaticFilterOptionsUseCase,
} from 'src/application/use-cases/saved-filter';
import { GetActiveFiltersUseCase } from 'src/application/use-cases/saved-filter/GetActiveFilters';
import { user } from 'src/kernel/types/context';
import { AuthGuard } from '../context/auth.guard';
import { toFilter } from '../mappers/saved-filter.mapper';

import { GetHomeMetricsUseCase } from 'src/application/use-cases/metrics/GetHomeMetrics';
import { GetLibrariesUseCase } from 'src/application/use-cases/music-library/GetLibraries';
import { GetRandomTrackWithStatsUseCase } from 'src/application/use-cases/music-track/GetRandomTrackWithStats';
import { Maybe, MusicTrack } from 'src/kernel/types';
import { toMusicLibrary } from '../mappers/music-library.mapper';
import { toTrack } from '../mappers/track.mapper';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Library } from '../schema/library.schema';
import { HomeMetrics } from '../schema/metrics.schema';
import { MusicPlayer } from '../schema/music-player.schema';
import { ICursorPaginatedType, IPaginatedType } from '../schema/pagination.schema';
import { Playlist } from '../schema/playlist.schema';
import { QueueItem } from '../schema/queue-item.schema';
import { FilterCriteriaResult, StaticFilterOptions } from '../schema/saved-filter.schema';
import {
  CursorPaginatedTracks,
  PaginatedTracks,
  RandomTrackWithStats,
  Track,
} from '../schema/track.schema';
import { PlaylistsResult, User } from '../schema/user.schema';

@Resolver(() => User)
@UseGuards(AuthGuard)
export class UserResolver {
  constructor(
    private readonly getPlaylistsUseCase: GetPlaylistsUseCase,
    private readonly getQueueUseCase: GetQueueUseCase,
    private readonly getStaticFilterOptionsUseCase: GetStaticFilterOptionsUseCase,
    private readonly getActiveFiltersUseCase: GetActiveFiltersUseCase,
    private readonly getCurrentFilterUseCase: GetCurrentFilterUseCase,
    private readonly getHomeMetricsUseCase: GetHomeMetricsUseCase,
    private readonly getRandomTrackIdUseCase: GetRandomTrackIdUseCase,
    private readonly getLibrariesUseCase: GetLibrariesUseCase,
    private readonly getTracksPaginatedUseCase: GetTracksWithPaginationUseCase,
    private readonly getPendingTracksUseCase: GetPendingTracksUseCase,
    private readonly getRandomTrackWithStatsUseCase: GetRandomTrackWithStatsUseCase,
    private readonly getTracksWithCursorPaginationUseCase: GetTracksWithCursorPaginationUseCase,
    private readonly getFavoriteUseCase: GetFavoriteUseCase,
    private readonly getRecentlyPlayedUseCase: GetRecentlyPlayedUseCase,
  ) {}

  @Query(() => User)
  async me(): Promise<ReturnType<typeof user>> {
    return user();
  }

  @ResolveField(() => PlaylistsResult)
  async playlists(): Promise<PlaylistsResult> {
    const items = await this.getPlaylistsUseCase.execute();
    return { items };
  }

  @ResolveField(() => [QueueItem])
  async queue(): Promise<QueueItem[]> {
    const items = await this.getQueueUseCase.execute();
    return items.map((item) => ({
      id: item.id,
      trackId: item.trackId,
      position: item.position,
      track: item.track ? toTrack(item.track) : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  @ResolveField(() => StaticFilterOptions)
  async staticFilterOptions(): Promise<StaticFilterOptions> {
    return this.getStaticFilterOptionsUseCase.execute();
  }

  @ResolveField(() => [FilterCriteriaResult], { nullable: true })
  async activeFilters(): Promise<Maybe<FilterCriteriaResult[]>> {
    return this.getActiveFiltersUseCase.execute().then((filters) => filters.map(toFilter));
  }

  @ResolveField(() => FilterCriteriaResult, { nullable: true })
  async currentFilter(): Promise<FilterCriteriaResult> {
    return this.getCurrentFilterUseCase.execute().then(toFilter);
  }

  @ResolveField(() => HomeMetrics)
  async homeMetrics(): Promise<HomeMetrics> {
    return this.getHomeMetricsUseCase.execute();
  }

  @ResolveField(() => [Track])
  async recentlyPlayed(): Promise<Track[]> {
    return this.getRecentlyPlayedUseCase.execute().then((tracks) => tracks.map(toTrack));
  }

  @ResolveField(() => MusicPlayer)
  async musicPlayer(): Promise<MusicPlayer> {
    return {
      currentWaveformData: [],
    };
  }

  @ResolveField(() => CursorPaginatedTracks)
  async tracks(
    @Args('pagination', {
      type: () => CursorPaginationArgs<MusicTrack>,
      nullable: true,
    })
    pagination?: CursorPaginationArgs<MusicTrack>,
  ): Promise<ICursorPaginatedType<Track>> {
    return this.getTracksWithCursorPaginationUseCase
      .execute({
        cursor:
          pagination?.cursor && pagination?.direction
            ? {
                id: pagination?.cursor,
                direction: pagination?.direction,
              }
            : null,
        size: pagination?.size ?? 20,
      })
      .then((tracks) => ({
        ...tracks,
        items: tracks.items.map(toTrack),
      }));
  }

  @ResolveField(() => PaginatedTracks)
  async paginatedTracks(
    @Args('pagination', { type: () => PaginationArgs, nullable: true })
    pagination: PaginationArgs,
  ): Promise<IPaginatedType<Track>> {
    return this.getTracksPaginatedUseCase
      .execute({
        pagination: {
          limit: pagination.limit,
          offset: pagination.offset,
          orderBy: pagination.orderBy ?? 'createdAt',
          orderDirection: pagination.orderDirection ?? 'desc',
        },
      })
      .then((tracks) => ({
        ...tracks,
        items: tracks.items.map(toTrack),
      }));
  }

  @ResolveField(() => PaginatedTracks)
  async pendingTracks(
    @Args('pagination', { type: () => PaginationArgs, nullable: true })
    pagination: PaginationArgs,
  ): Promise<IPaginatedType<Track>> {
    return this.getPendingTracksUseCase
      .execute({
        pagination: {
          limit: pagination.limit,
          offset: pagination.offset,
          orderBy: pagination.orderBy ?? 'createdAt',
          orderDirection: pagination.orderDirection ?? 'desc',
        },
      })
      .then((tracks) => ({
        ...tracks,
        items: tracks.items.map(toTrack),
      }));
  }
  @ResolveField(() => Base64ID, { nullable: true })
  async randomTrackId(): Promise<string | null> {
    return this.getRandomTrackIdUseCase.execute() ?? '';
  }

  @ResolveField(() => RandomTrackWithStats)
  async randomTrackWithStats(): Promise<RandomTrackWithStats> {
    return this.getRandomTrackWithStatsUseCase.execute().then((result) => ({
      track: result.track ? toTrack(result.track) : null,
      likedCount: result.likedCount,
      bangerCount: result.bangerCount,
      dislikedCount: result.dislikedCount,
      remainingCount: result.remainingCount,
    }));
  }

  @ResolveField(() => [Library])
  async libraries(): Promise<Library[]> {
    return this.getLibrariesUseCase.execute().then((libraries) => libraries.map(toMusicLibrary));
  }

  @ResolveField(() => Playlist)
  async favorites(): Promise<Playlist> {
    return this.getFavoriteUseCase.execute().then((playlist) => ({
      ...playlist,
      tracks: playlist.tracks.map((track) => ({
        ...track,
        track: toTrack(track.track),
      })),
    }));
  }
}
