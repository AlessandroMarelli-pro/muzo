import { SavedFilter } from 'src/clean-arch/kernel/types/model-types';

import { SavedFilterId } from 'src/clean-arch/kernel/ids';

export const SAVED_FILTER_REPOSITORY = Symbol('SAVED_FILTER_REPOSITORY');

export interface ISavedFilterRepository {
  save(data: SavedFilter): Promise<SavedFilter>;
  getById(id: SavedFilterId): Promise<SavedFilter>;
  update(id: SavedFilterId, data: SavedFilter): Promise<SavedFilter>;
}
