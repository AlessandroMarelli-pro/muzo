import { Type } from '@nestjs/common';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Maybe } from 'src/kernel/common';
import { Base64ID } from '../scalars/base64-id.scalar';

export interface IPaginatedType<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export function Paginated<T>(classRef: Type<T>): Type<IPaginatedType<T>> {
  @ObjectType({ isAbstract: true })
  abstract class PaginatedType implements IPaginatedType<T> {
    @Field(() => [classRef], { nullable: true })
    items: T[];

    @Field(() => Int)
    total: number;

    @Field(() => Int)
    page: number;

    @Field(() => Int)
    limit: number;

    @Field(() => Int)
    pages: number;
  }
  return PaginatedType as Type<IPaginatedType<T>>;
}

export type ICursorPaginatedType<T> = {
  items: T[];
  nextCursor: Maybe<string>;
  hasMore: boolean;
};

export function CursorPaginated<T>(
  classRef: Type<T>,
): Type<ICursorPaginatedType<T>> {
  @ObjectType({ isAbstract: true })
  abstract class CursorPaginatedType implements ICursorPaginatedType<T> {
    @Field(() => Boolean)
    hasMore: boolean;

    @Field(() => [classRef], { nullable: true })
    items: T[];

    @Field(() => Base64ID, { nullable: true })
    nextCursor: string;
  }
  return CursorPaginatedType as Type<ICursorPaginatedType<T>>;
}
