import { Args, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { CreateLibraryInput } from 'src/adapters/graphql/schema/library.input';
import {
  CreateLibraryUseCase,
  DeleteLibraryUseCase,
  GetTracksWithCursorPaginationUseCase,
  ScheduleLibraryScanUseCase,
  StopLibraryScanUseCase,
} from 'src/application/use-cases';

import { UseGuards } from '@nestjs/common';
import { SessionId } from 'src/kernel/ids';
import { MusicTrack } from 'src/kernel/types';
import { parseMusicLibraryId, parseSessionId } from '../../common/utils/parse-id';
import { AuthGuard } from '../context/auth.guard';
import { toMusicLibrary } from '../mappers/music-library.mapper';
import { toTrack } from '../mappers/track.mapper';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Library } from '../schema/library.schema';
import { CursorPaginationArgs } from '../schema/pagination.args';
import { ICursorPaginatedType } from '../schema/pagination.schema';
import { CursorPaginatedTracks, Track } from '../schema/track.schema';

@Resolver(() => Library)
@UseGuards(AuthGuard)
export class MusicLibraryResolver {
  constructor(
    private readonly createLibraryUseCase: CreateLibraryUseCase,
    private readonly deleteLibraryUseCase: DeleteLibraryUseCase,
    private readonly getTracksWithCursorPaginationUseCase: GetTracksWithCursorPaginationUseCase,
    private readonly scheduleLibraryScanUseCase: ScheduleLibraryScanUseCase,
    private readonly stopLibraryScanUseCase: StopLibraryScanUseCase,
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
    if (!parent.id) return { items: [], nextCursor: null, hasMore: false };
    const libraryId = parseMusicLibraryId(parent.id);
    return this.getTracksWithCursorPaginationUseCase
      .execute(
        {
          cursor:
            pagination?.cursor && pagination?.direction
              ? {
                  id: pagination?.cursor,
                  direction: pagination?.direction,
                }
              : null,
          size: pagination?.size ?? 20,
        },
        libraryId,
      )
      .then((tracks) => ({
        ...tracks,
        items: tracks.items.map(toTrack),
      }));
  }

  @Mutation(() => Library)
  async createLibrary(@Args('input') input: CreateLibraryInput): Promise<Library> {
    return this.createLibraryUseCase.execute(input).then((library) => {
      this.scheduleLibraryScanUseCase.execute(parseMusicLibraryId(library.id), false);
      return toMusicLibrary(library);
    });
  }

  @Mutation(() => Boolean)
  async deleteLibrary(@Args('id', { type: () => Base64ID }) id: string): Promise<boolean> {
    return this.deleteLibraryUseCase.execute(parseMusicLibraryId(id));
  }

  @Mutation(() => Base64ID)
  async startLibraryScan(
    @Args('libraryId', { type: () => Base64ID }) libraryId: string,
    @Args('incremental', { nullable: true }) incremental?: boolean,
  ): Promise<SessionId> {
    return this.scheduleLibraryScanUseCase
      .execute(parseMusicLibraryId(libraryId), incremental ?? false)
      .then(({ sessionId }) => sessionId);
  }

  @Mutation(() => Boolean)
  async stopLibraryScan(
    @Args('libraryId', { type: () => Base64ID }) libraryId: string,
    @Args('sessionId', { type: () => Base64ID, nullable: true }) sessionId?: string,
  ): Promise<boolean> {
    return this.stopLibraryScanUseCase.execute(
      parseMusicLibraryId(libraryId),
      sessionId ? parseSessionId(sessionId) : null,
    );
  }
}
