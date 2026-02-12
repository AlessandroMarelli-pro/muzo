import { Field, Float, ObjectType } from '@nestjs/graphql';
import { Track } from './track.schema';

@ObjectType()
export class TrackRecommendation {
  @Field(() => Track)
  track: Track;

  @Field(() => Float)
  similarity: number;

  @Field(() => [String])
  reasons: string[];
}
