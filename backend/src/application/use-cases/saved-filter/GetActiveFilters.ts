import { SavedFilter } from 'src/kernel/types/model-types';
import { ISavedFilterRepository } from '../../ports/repositories/ISavedFilterRepository';

export class GetActiveFiltersUseCase {
  constructor(private readonly savedFilterRepository: ISavedFilterRepository) {}

  async execute(): Promise<SavedFilter[]> {
    return this.savedFilterRepository.getAll();
  }
}
