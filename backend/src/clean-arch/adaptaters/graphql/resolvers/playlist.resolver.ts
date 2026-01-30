import { UseGuards, UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreatePlaylistUseCase } from 'src/clean-arch/application/use-cases/playlist/CreatePlaylist';
import { GetPlaylistsUseCase } from 'src/clean-arch/application/use-cases/playlist/GetPlaylists';
import { user } from 'src/clean-arch/kernel/types/context';
import { ActionContextInterceptor } from '../context/action-context.interceptor';
import { AuthGuard } from '../context/auth.guard';
import { CleanArchCreatePlaylistInput } from '../schema/playlist.input';
import { CleanArchPlaylist } from '../schema/playlist.schema';

@Resolver('CleanArchPlaylist')
@UseGuards(AuthGuard)
@UseInterceptors(ActionContextInterceptor)
export class CleanArchPlaylistResolver {
  constructor(
    private readonly createPlaylistUseCase: CreatePlaylistUseCase,
    private readonly getPlaylistsUseCase: GetPlaylistsUseCase,
  ) {}

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

  @Query(() => [CleanArchPlaylist])
  async caPlaylists(): Promise<CleanArchPlaylist[]> {
    const userId = user().id;
    return this.getPlaylistsUseCase.execute(userId);
  }
}
