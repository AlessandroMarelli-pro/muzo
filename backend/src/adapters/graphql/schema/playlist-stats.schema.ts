import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { Range } from './common.schema';

@ObjectType()
export class PlaylistStats {
  @Field(() => Range)
  bpmRange: Range;

  @Field(() => Int)
  genresCount: number;

  @Field(() => Int)
  subgenresCount: number;

  @Field(() => [String])
  topGenres: string[];

  @Field(() => [String])
  topSubgenres: string[];

  @Field(() => Int)
  numberOfTracks: number;

  @Field(() => Float)
  totalDuration: number;

  @Field(() => [String])
  images: string[];
}
