import { SavedFilterId } from 'src/clean-arch/kernel/ids';
import { SavedFilter } from 'src/clean-arch/kernel/types';
import {
  ISavedFilterRepository,
  SavedFilterData,
} from '../../ports/repositories/ISavedFilterRepository';

export class UpdateSavedFilterUseCase {
  constructor(private readonly savedFilterRepository: ISavedFilterRepository) {}

  async execute(
    id: SavedFilterId,
    data: SavedFilterData,
  ): Promise<SavedFilter> {
    return this.savedFilterRepository.updateById(id, data);
  }
}
