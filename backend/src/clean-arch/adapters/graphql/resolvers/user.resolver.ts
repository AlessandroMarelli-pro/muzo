// user.resolver.ts
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { GetPlaylistsUseCase } from 'src/clean-arch/application/use-cases';
import { user } from 'src/clean-arch/kernel/types/context';
import { ActionContextInterceptor } from '../context/action-context.interceptor';
import { AuthGuard } from '../context/auth.guard';
import { PlaylistsResult, User } from '../schema/user.schema';

@Resolver(() => User)
@UseGuards(AuthGuard)
@UseInterceptors(ActionContextInterceptor)
export class UserResolver {
  constructor(private readonly getPlaylistsUseCase: GetPlaylistsUseCase) {}

  @Query(() => User)
  async me(): Promise<ReturnType<typeof user>> {
    return user();
  }

  @ResolveField(() => PlaylistsResult)
  async playlists(
    @Parent() parent: ReturnType<typeof user>,
  ): Promise<PlaylistsResult> {
    const items = await this.getPlaylistsUseCase.execute(parent.id);
    return { items };
  }
}
