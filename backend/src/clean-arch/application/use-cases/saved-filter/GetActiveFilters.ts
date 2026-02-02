import { Inject, Injectable } from '@nestjs/common';
import { SavedFilter } from 'src/clean-arch/kernel/types/model-types';
import {
  ISavedFilterRepository,
  SAVED_FILTER_REPOSITORY,
} from '../../ports/repositories/ISavedFilterRepository';

@Injectable()
export class GetActiveFiltersUseCase {
  constructor(
    @Inject(SAVED_FILTER_REPOSITORY)
    private readonly savedFilterRepository: ISavedFilterRepository,
  ) {}

  async execute(): Promise<SavedFilter[]> {
    return this.savedFilterRepository.getAll();
  }
}
