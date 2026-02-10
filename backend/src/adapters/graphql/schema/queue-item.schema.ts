import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Maybe } from 'src/kernel/common';
import { MusicTrackId, QueueItemId } from 'src/kernel/ids';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Track } from './track.schema';

@ObjectType('QueueItem')
export class QueueItem {
  @Field(() => Base64ID)
  id: QueueItemId;

  @Field(() => Base64ID)
  trackId: MusicTrackId;

  @Field(() => Int)
  position: number;

  @Field(() => Track, { nullable: true })
  track: Maybe<Track>;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date, { nullable: true })
  updatedAt?: Date;
}

@ObjectType('RemoveTrackFromQueueResponse')
export class RemoveTrackFromQueueResponse {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => Base64ID)
  trackId: string;

  @Field(() => String, { nullable: true })
  artist: Maybe<string>;

  @Field(() => String, { nullable: true })
  title: Maybe<string>;
}
