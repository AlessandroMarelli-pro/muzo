import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Base64ID } from '../scalars/base64-id.scalar';

@ObjectType()
export class HqAudioBatchDownload {
  @Field(() => Base64ID)
  batchId: string;

  @Field(() => Int)
  totalToDownload: number;
}
