import { UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { PlaylistStatsLoader } from 'src/clean-arch/adapters/persistence/queries/playlist-stats.loader';
import {
  CreatePlaylistUseCase,
  DeletePlaylistUseCase,
  GetPlaylistSortingByPlaylistIdUseCase,
  GetPlaylistsUseCase,
  GetPlaylistUseCase,
  UpdatePlaylistUseCase,
} from 'src/clean-arch/application/use-cases';
import { Maybe } from 'src/clean-arch/kernel/common';
import { PlaylistContainsTrackLoader } from '../../persistence/repositories/playlist-track/playlist-contains-track.loader';
import { PlaylistTracksWithTrackLoader } from '../../persistence/repositories/playlist-track/playlist-track-with-track.loader';
import { AuthGuard } from '../context/auth.guard';
import { toTrack } from '../mappers/track.mapper';
import { Base64ID } from '../scalars/base64-id.scalar';
import { CleanArchPlaylistSorting } from '../schema/playlist-sorting.schema';
import { CleanArchPlaylistStats as PlaylistStats } from '../schema/playlist-stats.schema';
import { CleanArchPlaylistTrack as PlaylistTrack } from '../schema/playlist-track.schema';
import {
  CleanArchCreatePlaylistInput,
  CleanArchUpdatePlaylistInput,
} from '../schema/playlist.input';
import { CleanArchPlaylist } from '../schema/playlist.schema';
import { parseMusicTrackId, parsePlaylistId } from '../utils/parse-id';

@Resolver(() => CleanArchPlaylist)
@UseGuards(AuthGuard)
export class CleanArchPlaylistResolver {
  constructor(
    private readonly createPlaylistUseCase: CreatePlaylistUseCase,
    private readonly updatePlaylistUseCase: UpdatePlaylistUseCase,
    private readonly deletePlaylistUseCase: DeletePlaylistUseCase,
    private readonly getPlaylistUseCase: GetPlaylistUseCase,
    private readonly getPlaylistsUseCase: GetPlaylistsUseCase,
    private readonly getPlaylistSortingByPlaylistIdUseCase: GetPlaylistSortingByPlaylistIdUseCase,
  ) {}

  @Query(() => CleanArchPlaylist)
  async playlist(@Args('id', { type: () => Base64ID }) id: string) {
    return this.getPlaylistUseCase
      .execute(parsePlaylistId(id))
      .then((playlist) => {
        return {
          ...playlist,
          tracks: playlist.tracks.map((track) => ({
            ...track,
            track: toTrack(track.track),
          })),
        };
      });
  }
  @Query(() => [CleanArchPlaylist])
  async playlists() {
    return this.getPlaylistsUseCase.execute();
  }

  @ResolveField(() => PlaylistStats)
  async stats(
    @Parent() parent: CleanArchPlaylist,
    @Context() context: { loaders: { playlistStats: PlaylistStatsLoader } },
  ): Promise<PlaylistStats> {
    return context.loaders.playlistStats.load(parsePlaylistId(parent.id));
  }

  @ResolveField(() => [PlaylistTrack])
  async tracks(
    @Parent() parent: CleanArchPlaylist,
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

  @ResolveField(() => CleanArchPlaylistSorting)
  async sorting(
    @Parent() parent: CleanArchPlaylist,
  ): Promise<Maybe<CleanArchPlaylistSorting>> {
    if (parent.sorting != null) {
      return parent.sorting;
    }
    return this.getPlaylistSortingByPlaylistIdUseCase.execute(
      parsePlaylistId(parent.id),
    );
  }

  @ResolveField(() => Boolean)
  async containsTrack(
    @Parent() parent: CleanArchPlaylist,
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

  @Mutation(() => CleanArchPlaylist)
  async caCreatePlaylist(
    @Args('input') input: CleanArchCreatePlaylistInput,
  ): Promise<CleanArchPlaylist> {
    return this.createPlaylistUseCase.execute({
      name: input.name,
      description: input.description ?? null,
      isPublic: input.isPublic ?? false,
    });
  }

  @Mutation(() => CleanArchPlaylist)
  async caUpdatePlaylist(
    @Args('id', { type: () => Base64ID }) id: string,
    @Args('input') input: CleanArchUpdatePlaylistInput,
  ): Promise<CleanArchPlaylist> {
    return this.updatePlaylistUseCase.execute(parsePlaylistId(id), {
      name: input.name ?? undefined,
      description: input.description ?? undefined,
      isPublic: input.isPublic ?? undefined,
    });
  }
  @Mutation(() => Boolean)
  async caDeletePlaylist(
    @Args('id', { type: () => Base64ID }) id: string,
  ): Promise<boolean> {
    return this.deletePlaylistUseCase.execute(parsePlaylistId(id));
  }
}
