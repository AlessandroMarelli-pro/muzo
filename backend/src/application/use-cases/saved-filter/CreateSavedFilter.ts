import { models, SavedFilter } from 'src/kernel/types';
import {
  ISavedFilterRepository,
  SavedFilterData,
} from '../../ports/repositories/ISavedFilterRepository';

export class CreateSavedFilterUseCase {
  constructor(private readonly savedFilterRepository: ISavedFilterRepository) {}

  async execute(data: SavedFilterData): Promise<SavedFilter> {
    const savedFilter = models.savedFilter.instantiateNew(data);

    return this.savedFilterRepository.save(savedFilter);
  }
}
