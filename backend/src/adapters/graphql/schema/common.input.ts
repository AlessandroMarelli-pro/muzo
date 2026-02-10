import { Field, Float, InputType } from '@nestjs/graphql';

@InputType()
export class RangeInput {
  @Field(() => Float, { nullable: true })
  min?: number;

  @Field(() => Float, { nullable: true })
  max?: number;
}
