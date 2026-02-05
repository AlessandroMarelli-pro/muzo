import { Field, InputType, Int } from '@nestjs/graphql';
import { SortingDirection } from 'src/clean-arch/kernel/types';

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
