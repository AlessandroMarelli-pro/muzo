import { SavedFilterId } from 'src/kernel/ids';
import { SavedFilter } from 'src/kernel/types';
import {
  ISavedFilterRepository,
  SavedFilterData,
} from '../../ports/repositories/ISavedFilterRepository';

export class UpdateSavedFilterUseCase {
  constructor(private readonly savedFilterRepository: ISavedFilterRepository) {}

  async execute(id: SavedFilterId, data: SavedFilterData): Promise<SavedFilter> {
    return this.savedFilterRepository.updateById(id, data);
  }
}
