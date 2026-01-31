// user.resolver.ts
import { UseGuards } from '@nestjs/common';
import { Query, ResolveField, Resolver } from '@nestjs/graphql';
import { GetPlaylistsUseCase } from 'src/clean-arch/application/use-cases';
import { user } from 'src/clean-arch/kernel/types/context';
import { AuthGuard } from '../context/auth.guard';
import { PlaylistsResult, User } from '../schema/user.schema';

@Resolver(() => User)
@UseGuards(AuthGuard)
export class UserResolver {
  constructor(private readonly getPlaylistsUseCase: GetPlaylistsUseCase) {}

  @Query(() => User)
  async me(): Promise<ReturnType<typeof user>> {
    return user();
  }

  @ResolveField(() => PlaylistsResult)
  async playlists(): Promise<PlaylistsResult> {
    const items = await this.getPlaylistsUseCase.execute();
    return { items };
  }
}
