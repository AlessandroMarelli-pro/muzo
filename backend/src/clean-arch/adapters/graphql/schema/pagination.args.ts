import { Field, InputType, Int } from '@nestjs/graphql';
import { Model, SortingDirection } from 'src/clean-arch/kernel/types';
import { Base64ID } from '../scalars/base64-id.scalar';

@InputType()
export class PaginationArgs {
  @Field(() => Int, { nullable: true })
  limit?: number;

  @Field(() => Int, { nullable: true })
  offset?: number;

  @Field(() => String, { nullable: true })
  orderBy?: string;

  @Field(() => String, { nullable: true })
  orderDirection?: SortingDirection;
}

@InputType()
export class CursorPaginationArgs<T extends Model> {
  @Field(() => Int, { nullable: true })
  size?: number;

  @Field(() => Base64ID, { nullable: true })
  cursor?: T['id'];

  @Field(() => String, { nullable: true })
  direction?: 'BEFORE' | 'AFTER';
}
