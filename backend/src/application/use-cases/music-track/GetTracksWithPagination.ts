import { MusicTrack } from 'src/kernel/types/model-types';
import { PaginationResult, WithPagination } from 'src/kernel/types/pagination';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import { ISavedFilterRepository } from '../../ports/repositories/ISavedFilterRepository';

export class GetTracksWithPaginationUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    private readonly savedFilterRepository: ISavedFilterRepository,
  ) {}

  async execute(pagination: WithPagination): Promise<PaginationResult<MusicTrack>> {
    let criteria = await this.savedFilterRepository.getCurrentFilter();

    const subgenreIds = await this.musicTrackRepository.getAllSubgenresBySubgenreId(
      criteria?.criteria.subgenreIds || [],
    );
    if (criteria && subgenreIds.length > 0) {
      criteria.criteria = { ...criteria?.criteria, subgenreIds };
    }
    return this.musicTrackRepository.getManyByCriteriaWithPagination(
      criteria?.criteria ?? null,
      pagination,
    );
  }
}
