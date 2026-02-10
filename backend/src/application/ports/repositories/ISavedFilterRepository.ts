import { SavedFilterId } from 'src/kernel/ids';
import { FilterCriteria, SavedFilter } from 'src/kernel/types/model-types';
import { createToken } from '../../utils/create-token';

export const SAVED_FILTER_REPOSITORY = createToken<ISavedFilterRepository>(
  'SAVED_FILTER_REPOSITORY',
);

export type SavedFilterData = {
  name: string;
  criteria: FilterCriteria;
  isCurrent: boolean;
};
export interface ISavedFilterRepository {
  save(data: SavedFilter): Promise<SavedFilter>;
  getById(id: SavedFilterId): Promise<SavedFilter>;
  updateById(id: SavedFilterId, data: SavedFilterData): Promise<SavedFilter>;
  getAll(): Promise<SavedFilter[]>;
  deleteById(id: SavedFilterId): Promise<boolean>;
  getCurrentFilter(): Promise<SavedFilter>;
}
