import { Injectable } from '@nestjs/common';
import { SavedFilter } from 'src/clean-arch/kernel/types/model-types';
import { ISavedFilterRepository } from '../../ports/repositories/ISavedFilterRepository';

@Injectable()
export class GetActiveFiltersUseCase {
  constructor(private readonly savedFilterRepository: ISavedFilterRepository) {}

  async execute(): Promise<SavedFilter[]> {
    return this.savedFilterRepository.getAll();
  }
}
