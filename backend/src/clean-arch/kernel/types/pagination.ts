import { Maybe } from '../common';
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

export type PaginationAndSortingOptions = PaginationOptions & SortingOptions;

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

export type WithCursorPagination<T extends Model> = {
  size: Maybe<number>;
  cursor: Maybe<{
    id: T['id'];
    direction: 'BEFORE' | 'AFTER';
  }>;
};

export type CursorPaginationResult<T extends Model> = {
  items: T[];
  nextCursor: Maybe<string>;
  hasMore: boolean;
};
