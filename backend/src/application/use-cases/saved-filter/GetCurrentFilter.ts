import { SavedFilter } from 'src/kernel/types';
import { ISavedFilterRepository } from '../../ports/repositories/ISavedFilterRepository';

export class GetCurrentFilterUseCase {
  constructor(private readonly savedFilterRepository: ISavedFilterRepository) {}
  async execute(): Promise<SavedFilter> {
    return this.savedFilterRepository.getCurrentFilter();
  }
}
