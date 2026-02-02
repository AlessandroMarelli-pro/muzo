import {
  FilterCriteria,
  SavedFilter,
} from 'src/clean-arch/kernel/types/model-types';

import { SavedFilterId } from 'src/clean-arch/kernel/ids';

export const SAVED_FILTER_REPOSITORY = Symbol('SAVED_FILTER_REPOSITORY');

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
