import { SavedFilterId } from 'src/kernel/ids';
import { SavedFilter } from 'src/kernel/types/model-types';
import { ISavedFilterRepository } from '../../ports/repositories/ISavedFilterRepository';

export class GetSavedFilterUseCase {
  constructor(private readonly savedFilterRepository: ISavedFilterRepository) {}

  async execute(id: SavedFilterId): Promise<SavedFilter> {
    return this.savedFilterRepository.getById(id);
  }
}
