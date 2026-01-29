import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { SimpleMusicTrack } from '../music-track/music-track.model';

@ObjectType()
export class QueueItem {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  trackId: string;

  @Field(() => Int)
  position: number;

  @Field(() => SimpleMusicTrack, { nullable: true })
  track?: SimpleMusicTrack;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@InputType()
export class UpdateQueuePositionInput {
  @Field(() => ID)
  trackId: string;

  @Field(() => Int)
  position: number;
}

@InputType()
export class UpdateQueuePositionsInput {
  @Field(() => [UpdateQueuePositionInput])
  positions: UpdateQueuePositionInput[];
}
