import { UseGuards } from '@nestjs/common';
import { Args, Context, Int, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { PlaylistStatsLoader } from 'src/adapters/persistence/queries/playlist/playlist-stats.loader';
import {
  CreatePlaylistUseCase,
  DeletePlaylistUseCase,
  DuplicatePlaylistUseCase,
  ExportPlaylistToM3UUseCase,
  DownloadPlaylistToFolderUseCase,
  GetPlaylistAutomixOrderUseCase,
  GetPlaylistRecommendationsUseCase,
  GetPlaylistSortingByPlaylistIdUseCase,
  MergePlaylistsUseCase,
  SchedulePlaylistTracksScanUseCase,
  UpdatePlaylistUseCase,
} from 'src/application/use-cases';
import { AcquireHqAudioBatchUseCase } from 'src/application/use-cases/hq-audio-batch/AcquireHqAudioBatch';
import { StartHqAudioBatchDownloadUseCase } from 'src/application/use-cases/hq-audio-batch/StartHqAudioBatchDownload';
import { HqAudioBatchId } from 'src/kernel/ids';
import { UpdatePlaylistSortingUseCase } from 'src/application/use-cases/playlist-sorting/UpdatePlaylistSorting';
import { Maybe } from 'src/kernel/common';
import { RecommendationSeedStrategy } from 'src/kernel/types';

import { parseMusicTrackId, parsePlaylistId, parsePlaylistTrackId } from '../../common/utils/parse-id';
import { PlaylistContainsTrackLoader } from '../../persistence/repositories/playlist-track/playlist-contains-track.loader';
import { PlaylistTracksWithTrackLoader } from '../../persistence/repositories/playlist-track/playlist-track-with-track.loader';
import { AuthGuard } from '../context/auth.guard';
import { toTrack } from '../mappers/track.mapper';
import { Base64ID } from '../scalars/base64-id.scalar';
import { HqAudioBatchDownload } from '../schema/hq-audio-batch.schema';
import { UpdatePlaylistSortingInput } from '../schema/playlist-sorting.input';
import { PlaylistSorting } from '../schema/playlist-sorting.schema';
import { PlaylistStats } from '../schema/playlist-stats.schema';
import { PlaylistTrack } from '../schema/playlist-track.schema';
import {
  CreatePlaylistInput,
  MergePlaylistsInput,
  UpdatePlaylistInput,
} from '../schema/playlist.input';
import { Playlist } from '../schema/playlist.schema';
import { TrackRecommendation } from '../schema/recommendation.schema';

@Resolver(() => Playlist)
@UseGuards(AuthGuard)
export class PlaylistResolver {
  constructor(
    private readonly createPlaylistUseCase: CreatePlaylistUseCase,
    private readonly updatePlaylistUseCase: UpdatePlaylistUseCase,
    private readonly deletePlaylistUseCase: DeletePlaylistUseCase,
    private readonly getPlaylistSortingByPlaylistIdUseCase: GetPlaylistSortingByPlaylistIdUseCase,
    private readonly exportPlaylistToM3UUseCase: ExportPlaylistToM3UUseCase,
    private readonly downloadPlaylistToFolderUseCase: DownloadPlaylistToFolderUseCase,
    private readonly updatePlaylistSortingUseCase: UpdatePlaylistSortingUseCase,
    private readonly getPlaylistRecommendationsUseCase: GetPlaylistRecommendationsUseCase,
    private readonly getPlaylistAutomixOrderUseCase: GetPlaylistAutomixOrderUseCase,
    private readonly startHqAudioBatchDownloadUseCase: StartHqAudioBatchDownloadUseCase,
    private readonly acquireHqAudioBatchUseCase: AcquireHqAudioBatchUseCase,
    private readonly schedulePlaylistTracksScanUseCase: SchedulePlaylistTracksScanUseCase,
    private readonly duplicatePlaylistUseCase: DuplicatePlaylistUseCase,
    private readonly mergePlaylistsUseCase: MergePlaylistsUseCase,
  ) {}

  @ResolveField(() => PlaylistStats)
  async stats(
    @Parent() parent: Playlist,
    @Context() context: { loaders: { playlistStats: PlaylistStatsLoader } },
  ): Promise<PlaylistStats> {
    return context.loaders.playlistStats.load(parsePlaylistId(parent.id));
  }

  @ResolveField(() => [PlaylistTrack])
  async tracks(
    @Parent() parent: Playlist,
    @Context()
    context: {
      loaders: { playlistTracksWithTrack: PlaylistTracksWithTrackLoader };
    },
  ): Promise<PlaylistTrack[]> {
    if (parent.tracks != null) {
      return parent.tracks;
    }
    return context.loaders.playlistTracksWithTrack
      .load(parsePlaylistId(parent.id))
      .then((playlistTracks) =>
        playlistTracks.map((playlistTrack) => ({
          ...playlistTrack,
          track: toTrack(playlistTrack.track),
        })),
      );
  }

  @ResolveField(() => PlaylistSorting)
  async sorting(@Parent() parent: Playlist): Promise<Maybe<PlaylistSorting>> {
    if (parent.sorting != null) {
      return parent.sorting;
    }
    return this.getPlaylistSortingByPlaylistIdUseCase.execute(parsePlaylistId(parent.id));
  }

  @ResolveField(() => Boolean)
  async containsTrack(
    @Parent() parent: Playlist,
    @Args('trackId', { type: () => Base64ID, nullable: true })
    trackId: string | null,
    @Context()
    context: {
      loaders: { playlistContainsTrack: PlaylistContainsTrackLoader };
    },
  ): Promise<boolean> {
    if (!trackId) {
      return false;
    }
    return context.loaders.playlistContainsTrack.load({
      playlistId: parsePlaylistId(parent.id),
      trackId: parseMusicTrackId(trackId),
    });
  }

  @Mutation(() => Playlist)
  async createPlaylist(@Args('input') input: CreatePlaylistInput): Promise<Playlist> {
    return this.createPlaylistUseCase.execute({
      name: input.name,
      description: input.description ?? null,
      isPublic: input.isPublic ?? false,
      filters: input.filters ?? null,
      maxTracks: input.maxTracks ?? null,
      subgenreSelectionMode: input.subgenreSelectionMode ?? null,
    });
  }

  @Mutation(() => Playlist)
  async caUpdatePlaylist(
    @Args('id', { type: () => Base64ID }) id: string,
    @Args('input') input: UpdatePlaylistInput,
  ): Promise<Playlist> {
    return this.updatePlaylistUseCase.execute(parsePlaylistId(id), {
      name: input.name ?? undefined,
      description: input.description ?? undefined,
      isPublic: input.isPublic ?? undefined,
    });
  }

  @Mutation(() => Boolean)
  async deletePlaylist(@Args('id', { type: () => Base64ID }) id: string): Promise<boolean> {
    return this.deletePlaylistUseCase.execute(parsePlaylistId(id));
  }

  @Mutation(() => Playlist)
  async duplicatePlaylist(@Args('id', { type: () => Base64ID }) id: string): Promise<Playlist> {
    return this.duplicatePlaylistUseCase.execute(parsePlaylistId(id));
  }

  @Mutation(() => Playlist)
  async mergePlaylists(@Args('input') input: MergePlaylistsInput): Promise<Playlist> {
    return this.mergePlaylistsUseCase.execute(
      parsePlaylistId(input.sourceIdA),
      parsePlaylistId(input.sourceIdB),
      input.name,
    );
  }

  /** (Re-)schedule DSP analysis for every track in a playlist. `force: true` re-analyses
   *  tracks even if they already have results. Returns the scan session id. */
  @Mutation(() => Base64ID)
  async scanPlaylistTracks(
    @Args('playlistId', { type: () => Base64ID }) playlistId: string,
    @Args('force', { type: () => Boolean, nullable: true }) force?: boolean,
  ): Promise<string> {
    return this.schedulePlaylistTracksScanUseCase
      .execute(parsePlaylistId(playlistId), force ?? false)
      .then(({ sessionId }) => sessionId);
  }

  @Mutation(() => String)
  async exportPlaylistToM3U(@Args('playlistId', { type: () => Base64ID }) playlistId: string) {
    return this.exportPlaylistToM3UUseCase.execute(parsePlaylistId(playlistId));
  }

  @Mutation(() => Boolean)
  async downloadPlaylistToFolder(
    @Args('playlistId', { type: () => Base64ID }) playlistId: string,
  ): Promise<boolean> {
    return this.downloadPlaylistToFolderUseCase.execute(parsePlaylistId(playlistId));
  }

  @Mutation(() => HqAudioBatchDownload)
  async downloadPlaylistHqAudio(
    @Args('playlistId', { type: () => Base64ID }) playlistId: string,
  ): Promise<HqAudioBatchDownload> {
    const { batchId, totalToDownload } = await this.startHqAudioBatchDownloadUseCase.execute(
      parsePlaylistId(playlistId),
    );
    return { batchId, totalToDownload };
  }

  @Mutation(() => Boolean)
  async cancelPlaylistHqAudioDownload(
    @Args('batchId', { type: () => Base64ID }) batchId: string,
  ): Promise<boolean> {
    return this.acquireHqAudioBatchUseCase.cancel(batchId as HqAudioBatchId);
  }

  @Mutation(() => PlaylistSorting)
  async updatePlaylistSorting(
    @Args('playlistId', { type: () => Base64ID }) playlistId: string,
    @Args('input') input: UpdatePlaylistSortingInput,
  ) {
    return this.updatePlaylistSortingUseCase.execute(parsePlaylistId(playlistId), {
      sortingKey: input.sortingKey,
      sortingDirection: input.sortingDirection,
    });
  }

  @ResolveField(() => [TrackRecommendation])
  async recommendations(
    @Parent() parent: Playlist,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('seedStrategy', { type: () => String, nullable: true })
    seedStrategy?: RecommendationSeedStrategy,
    @Args('boosts', { type: () => [String], nullable: true }) boosts?: string[],
  ) {
    if (parent.recommendations != null) {
      return parent.recommendations;
    }
    if (parent.id == null) {
      return [];
    }
    const recommendations = await this.getPlaylistRecommendationsUseCase.execute(
      parsePlaylistId(parent.id),
      limit,
      seedStrategy,
      boosts,
    );

    return recommendations.map((recommendation) => ({
      track: toTrack(recommendation.track),
      similarity: recommendation.similarity,
      reasons: recommendation.reasons,
    }));
  }

  @ResolveField(() => [PlaylistTrack])
  async automixOrder(
    @Parent() parent: Playlist,
    @Args('seedTrackId', { type: () => Base64ID, nullable: true }) seedTrackId?: string,
  ): Promise<PlaylistTrack[]> {
    if (parent.id == null) {
      return [];
    }
    const ordered = await this.getPlaylistAutomixOrderUseCase.execute(
      parsePlaylistId(parent.id),
      seedTrackId ? parsePlaylistTrackId(seedTrackId) : undefined,
    );
    return ordered.map((playlistTrack) => ({
      ...playlistTrack,
      track: toTrack(playlistTrack.track),
    }));
  }
}
