import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CreateLibraryInput } from 'src/clean-arch/adapters/graphql/schema/library.input';
import {
  CreateLibraryUseCase,
  DeleteLibraryUseCase,
  GetTracksWithCursorPaginationUseCase,
} from 'src/clean-arch/application/use-cases';

import { MusicTrack } from 'src/clean-arch/kernel/types';
import { parseMusicLibraryId } from '../../common/utils/parse-id';
import { toMusicLibrary } from '../mappers/music-library.mapper';
import { toTrack } from '../mappers/track.mapper';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Library } from '../schema/library.schema';
import { CursorPaginationArgs } from '../schema/pagination.args';
import { ICursorPaginatedType } from '../schema/pagination.schema';
import { CursorPaginatedTracks, Track } from '../schema/track.schema';

@Resolver(() => Library)
export class MusicLibraryResolver {
  constructor(
    private readonly createLibraryUseCase: CreateLibraryUseCase,
    private readonly deleteLibraryUseCase: DeleteLibraryUseCase,
    private readonly getTracksWithCursorPaginationUseCase: GetTracksWithCursorPaginationUseCase,
  ) {}

  @ResolveField(() => CursorPaginatedTracks)
  async tracks(
    @Parent() parent: Library,
    @Args('pagination', {
      type: () => CursorPaginationArgs<MusicTrack>,
      nullable: true,
    })
    pagination?: CursorPaginationArgs<MusicTrack>,
  ): Promise<ICursorPaginatedType<Track>> {
    if (!parent.id) return;
    const libraryId = parseMusicLibraryId(parent.id);
    return this.getTracksWithCursorPaginationUseCase
      .execute(
        {
          cursor: {
            id: pagination?.cursor,
            direction: pagination?.direction,
          },
          size: pagination?.size,
        },
        libraryId,
      )
      .then((tracks) => ({
        ...tracks,
        items: tracks.items.map(toTrack),
      }));
  }

  @Mutation(() => Library)
  async createLibrary(
    @Args('input') input: CreateLibraryInput,
  ): Promise<Library> {
    return this.createLibraryUseCase.execute(input).then(toMusicLibrary);
  }

  @Mutation(() => Boolean)
  async deleteLibrary(
    @Args('id', { type: () => Base64ID }) id: string,
  ): Promise<boolean> {
    return this.deleteLibraryUseCase.execute(parseMusicLibraryId(id));
  }
}
