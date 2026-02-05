import { MusicLibraryId } from 'src/clean-arch/kernel/ids';
import {
  FilterCriteria,
  MusicTrack,
} from 'src/clean-arch/kernel/types/model-types';
import {
  CursorPaginationResult,
  WithCursorPagination,
} from 'src/clean-arch/kernel/types/pagination';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import { ISavedFilterRepository } from '../../ports/repositories/ISavedFilterRepository';

export class GetTracksWithCursorPaginationUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,

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
