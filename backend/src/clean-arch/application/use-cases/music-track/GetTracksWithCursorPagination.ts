import { Inject } from '@nestjs/common';
import { MusicLibraryId } from 'src/clean-arch/kernel/ids';
import {
  FilterCriteria,
  MusicTrack,
} from 'src/clean-arch/kernel/types/model-types';
import {
  CursorPaginationResult,
  WithCursorPagination,
} from 'src/clean-arch/kernel/types/pagination';
import {
  IMusicTrackRepository,
  MUSIC_TRACK_REPOSITORY,
} from '../../ports/repositories/IMusicTrackRepository';
import {
  ISavedFilterRepository,
  SAVED_FILTER_REPOSITORY,
} from '../../ports/repositories/ISavedFilterRepository';

export class GetTracksWithCursorPaginationUseCase {
  constructor(
    @Inject(MUSIC_TRACK_REPOSITORY)
    private readonly musicTrackRepository: IMusicTrackRepository,

    @Inject(SAVED_FILTER_REPOSITORY)
    private readonly savedFilterRepository: ISavedFilterRepository,
  ) {}

  async execute(
    pagination: WithCursorPagination<MusicTrack>,
    libraryId?: MusicLibraryId,
  ): Promise<CursorPaginationResult<MusicTrack>> {
    const filter = await this.savedFilterRepository.getCurrentFilter();
    let criteria = filter?.criteria;
    if (libraryId && criteria) {
      criteria.libraryIds = [libraryId];
    } else if (libraryId) {
      criteria = { libraryIds: [libraryId] } as FilterCriteria;
    }
    return this.musicTrackRepository.getManyByCriteriaWithCursorPagination(
      criteria,
      pagination,
    );
  }
}
