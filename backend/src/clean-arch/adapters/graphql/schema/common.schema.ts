import { Field, Float, ObjectType } from '@nestjs/graphql';

// GraphQL Object Types
@ObjectType()
export class Range {
  @Field(() => Float)
  min: number;

  @Field(() => Float)
  max: number;
}
