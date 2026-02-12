import { Field, InputType, Int } from '@nestjs/graphql';
import { Base64ID } from '../scalars/base64-id.scalar';

@InputType('UpdateQueuePositionInput')
export class UpdateQueuePositionInput {
  @Field(() => Base64ID)
  trackId: string;

  @Field(() => Int)
  position: number;
}

@InputType('UpdateQueuePositionsInput')
export class UpdateQueuePositionsInput {
  @Field(() => [UpdateQueuePositionInput])
  positions: UpdateQueuePositionInput[];
}
