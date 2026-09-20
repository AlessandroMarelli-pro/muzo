import { HiddenMusicTrack } from 'src/kernel/types/model-types';
import { PaginationResult, WithPagination } from 'src/kernel/types/pagination';
import { IHiddenMusicTrackRepository } from '../../ports/repositories/IHiddenMusicTrackRepository';

export class GetHiddenTracksUseCase {
  constructor(private readonly hiddenMusicTrackRepository: IHiddenMusicTrackRepository) {}

  async execute(pagination: WithPagination): Promise<PaginationResult<HiddenMusicTrack>> {
    return this.hiddenMusicTrackRepository.getManyWithPagination(pagination);
  }
}
