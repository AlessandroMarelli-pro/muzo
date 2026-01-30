import { UseGuards, UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CreatePlaylistUseCase,
  DeletePlaylistUseCase,
  GetPlaylistsUseCase,
  GetPlaylistUseCase,
  UpdatePlaylistUseCase,
} from 'src/clean-arch/application/use-cases';
import { user } from 'src/clean-arch/kernel/types/context';
import { ActionContextInterceptor } from '../context/action-context.interceptor';
import { AuthGuard } from '../context/auth.guard';
import { Base64ID } from '../scalars/base64-id.scalar';
import {
  CleanArchCreatePlaylistInput,
  CleanArchUpdatePlaylistInput,
} from '../schema/playlist.input';
import { CleanArchPlaylist } from '../schema/playlist.schema';
import { parsePlaylistId } from '../utils/parse-id';

@Resolver('CleanArchPlaylist')
@UseGuards(AuthGuard)
@UseInterceptors(ActionContextInterceptor)
export class CleanArchPlaylistResolver {
  constructor(
    private readonly createPlaylistUseCase: CreatePlaylistUseCase,
    private readonly getPlaylistsUseCase: GetPlaylistsUseCase,
    private readonly getPlaylistUseCase: GetPlaylistUseCase,
    private readonly updatePlaylistUseCase: UpdatePlaylistUseCase,
    private readonly deletePlaylistUseCase: DeletePlaylistUseCase,
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

  @Query(() => CleanArchPlaylist)
  async caPlaylist(
    @Args('id', { type: () => Base64ID }) id: string,
  ): Promise<CleanArchPlaylist> {
    return this.getPlaylistUseCase.execute(parsePlaylistId(id));
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
