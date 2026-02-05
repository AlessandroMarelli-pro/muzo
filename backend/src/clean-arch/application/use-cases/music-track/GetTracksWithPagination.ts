import { Inject } from '@nestjs/common';
import { MusicTrack } from 'src/clean-arch/kernel/types/model-types';
import {
  PaginationResult,
  WithPagination,
} from 'src/clean-arch/kernel/types/pagination';
import {
  IMusicTrackRepository,
  MUSIC_TRACK_REPOSITORY,
} from '../../ports/repositories/IMusicTrackRepository';
import {
  ISavedFilterRepository,
  SAVED_FILTER_REPOSITORY,
} from '../../ports/repositories/ISavedFilterRepository';

export class GetTracksWithPaginationUseCase {
  constructor(
    @Inject(MUSIC_TRACK_REPOSITORY)
    private readonly musicTrackRepository: IMusicTrackRepository,

    @Inject(SAVED_FILTER_REPOSITORY)
    private readonly savedFilterRepository: ISavedFilterRepository,
  ) {}

  async execute(
    pagination: WithPagination,
  ): Promise<PaginationResult<MusicTrack>> {
    const criteria = await this.savedFilterRepository.getCurrentFilter();
    return this.musicTrackRepository.getManyByCriteriaWithPagination(
      criteria?.criteria,
      pagination,
    );
  }
}
