// user.resolver.ts
import { UseGuards } from '@nestjs/common';
import { Query, ResolveField, Resolver } from '@nestjs/graphql';
import { GetPlaylistsUseCase } from 'src/clean-arch/application/use-cases';
import { GetStaticFilterOptionsUseCase } from 'src/clean-arch/application/use-cases/saved-filter';
import { user } from 'src/clean-arch/kernel/types/context';
import { AuthGuard } from '../context/auth.guard';
import { StaticFilterOptions } from '../schema/saved-filter.schema';
import { PlaylistsResult, User } from '../schema/user.schema';

@Resolver(() => User)
@UseGuards(AuthGuard)
export class UserResolver {
  constructor(
    private readonly getPlaylistsUseCase: GetPlaylistsUseCase,
    private readonly getStaticFilterOptionsUseCase: GetStaticFilterOptionsUseCase,
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

  @ResolveField(() => StaticFilterOptions)
  async staticFilterOptions(): Promise<StaticFilterOptions> {
    return this.getStaticFilterOptionsUseCase.execute();
  }
}
