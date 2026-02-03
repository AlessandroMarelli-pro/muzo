// user.resolver.ts
import { UseGuards } from '@nestjs/common';
import { Query, ResolveField, Resolver } from '@nestjs/graphql';
import {
  GetPlaylistsUseCase,
  GetQueueUseCase,
} from 'src/clean-arch/application/use-cases';
import {
  GetCurrentFilterUseCase,
  GetStaticFilterOptionsUseCase,
} from 'src/clean-arch/application/use-cases/saved-filter';
import { GetActiveFiltersUseCase } from 'src/clean-arch/application/use-cases/saved-filter/GetActiveFilters';
import { user } from 'src/clean-arch/kernel/types/context';
import { AuthGuard } from '../context/auth.guard';
import { toFilter } from '../mappers/saved-filter.mapper';

import { GetHomeMetricsUseCase } from 'src/clean-arch/application/use-cases/metrics/GetHomeMetrics';
import { toTrack } from '../mappers/track.mapper';
import { HomeMetrics } from '../schema/metrics.schema';
import { MusicPlayer } from '../schema/music-player.schema';
import { CleanArchQueueItem } from '../schema/queue-item.schema';
import {
  FilterCriteriaResult,
  StaticFilterOptions,
} from '../schema/saved-filter.schema';
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

  @ResolveField(() => [CleanArchQueueItem])
  async queue(): Promise<CleanArchQueueItem[]> {
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

  @ResolveField(() => [FilterCriteriaResult])
  async activeFilters(): Promise<FilterCriteriaResult[]> {
    return this.getActiveFiltersUseCase
      .execute()
      .then((filters) => filters.map(toFilter));
  }

  @ResolveField(() => FilterCriteriaResult, { nullable: true })
  async currentFilter(): Promise<FilterCriteriaResult> {
    return this.getCurrentFilterUseCase.execute().then(toFilter);
  }

  @ResolveField(() => HomeMetrics)
  async homeMetrics(): Promise<HomeMetrics> {
    return this.getHomeMetricsUseCase.execute();
  }

  @ResolveField(() => MusicPlayer)
  async musicPlayer(): Promise<MusicPlayer> {
    return {
      currentWaveformData: [],
    };
  }
}
