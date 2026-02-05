import { Model } from './model-types';

export const SORTING_DIRECTIONS = ['asc', 'desc'] as const;
export type SortingDirection = (typeof SORTING_DIRECTIONS)[number];
export type SortingOptions = {
  orderBy?: string;
  orderDirection?: SortingDirection;
};

export type PaginationOptions = {
  limit?: number;
  offset?: number;
};

export type PaginationResult<T extends Model> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type WithPagination = {
  pagination: PaginationOptions & SortingOptions;
};
