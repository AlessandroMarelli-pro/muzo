import { Parent, ResolveField, Resolver } from '@nestjs/graphql';

import { GetPlaylistSortingByPlaylistIdUseCase } from 'src/clean-arch/application/use-cases';
import { CleanArchPlaylistSorting } from '../schema/playlist-sorting.schema';
import { CleanArchPlaylist } from '../schema/playlist.schema';
import { parsePlaylistId } from '../utils/parse-id';

@Resolver(() => CleanArchPlaylistSorting)
export class CleanArchPlaylistSortingResolver {
  constructor(
    private readonly getPlaylistSortingByPlaylistIdUseCase: GetPlaylistSortingByPlaylistIdUseCase,
  ) {}

  @ResolveField(() => CleanArchPlaylistSorting)
  async sorting(
    @Parent() parent: CleanArchPlaylist,
  ): Promise<CleanArchPlaylistSorting> {
    return this.getPlaylistSortingByPlaylistIdUseCase.execute(
      parsePlaylistId(parent.id),
    );
  }
}
