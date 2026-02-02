import { Inject } from '@nestjs/common';
import { SavedFilterId } from 'src/clean-arch/kernel/ids';
import { SavedFilter } from 'src/clean-arch/kernel/types/model-types';
import {
  ISavedFilterRepository,
  SAVED_FILTER_REPOSITORY,
} from '../../ports/repositories/ISavedFilterRepository';

export class GetSavedFilterUseCase {
  constructor(
    @Inject(SAVED_FILTER_REPOSITORY)
    private readonly savedFilterRepository: ISavedFilterRepository,
  ) {}

  async execute(id: SavedFilterId): Promise<SavedFilter> {
    return this.savedFilterRepository.getById(id);
  }
}
