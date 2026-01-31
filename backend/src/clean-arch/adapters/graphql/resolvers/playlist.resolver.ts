import { UseGuards } from '@nestjs/common';
import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  CreatePlaylistUseCase,
  DeletePlaylistUseCase,
  GetPlaylistsUseCase,
  GetPlaylistUseCase,
  UpdatePlaylistUseCase,
} from 'src/clean-arch/application/use-cases';
import { GetPlaylistStatsUseCase } from 'src/clean-arch/application/use-cases/playlist/GetPlaylistStats';
import { GetPlaylistTracksUseCase } from 'src/clean-arch/application/use-cases/playlist/GetPlaylistTracks';
import { AuthGuard } from '../context/auth.guard';
import { Base64ID } from '../scalars/base64-id.scalar';
import { CleanArchPlaylistStats as PlaylistStats } from '../schema/playlist-stats.schema';
import { CleanArchPlaylistTrack as PlaylistTrack } from '../schema/playlist-track.schema';
import {
  CleanArchCreatePlaylistInput,
  CleanArchUpdatePlaylistInput,
} from '../schema/playlist.input';
import { CleanArchPlaylist } from '../schema/playlist.schema';
import { parsePlaylistId } from '../utils/parse-id';

@Resolver(() => CleanArchPlaylist)
@UseGuards(AuthGuard)
export class CleanArchPlaylistResolver {
  constructor(
    private readonly createPlaylistUseCase: CreatePlaylistUseCase,
    private readonly updatePlaylistUseCase: UpdatePlaylistUseCase,
    private readonly deletePlaylistUseCase: DeletePlaylistUseCase,
    private readonly getPlaylistStatsUseCase: GetPlaylistStatsUseCase,
    private readonly getPlaylistTracksUseCase: GetPlaylistTracksUseCase,
    private readonly getPlaylistUseCase: GetPlaylistUseCase,
    private readonly getPlaylistsUseCase: GetPlaylistsUseCase,
  ) {}

  @Query(() => CleanArchPlaylist)
  async playlist(@Args('id', { type: () => Base64ID }) id: string) {
    return this.getPlaylistUseCase.execute(parsePlaylistId(id));
  }
  @Query(() => [CleanArchPlaylist])
  async playlists() {
    return this.getPlaylistsUseCase.execute();
  }

  @ResolveField(() => PlaylistStats)
  async stats(@Parent() parent: CleanArchPlaylist): Promise<PlaylistStats> {
    return this.getPlaylistStatsUseCase.execute(parent.id);
  }

  @ResolveField(() => [PlaylistTrack])
  async tracks(@Parent() parent: CleanArchPlaylist): Promise<PlaylistTrack[]> {
    return this.getPlaylistTracksUseCase.execute(parent.id);
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
