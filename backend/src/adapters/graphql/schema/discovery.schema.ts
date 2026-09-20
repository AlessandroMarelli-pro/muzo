import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql';

@InputType()
export class CosineSimilarFiltersInput {
  @Field(() => Int, { nullable: true })
  startYear?: number;

  @Field(() => Int, { nullable: true })
  endYear?: number;

  @Field(() => Int, { nullable: true })
  minHave?: number;

  @Field(() => Int, { nullable: true })
  maxHave?: number;

  @Field(() => Int, { nullable: true })
  minWant?: number;

  @Field(() => Int, { nullable: true })
  maxWant?: number;

  @Field(() => Float, { nullable: true })
  minPrice?: number;

  @Field(() => Float, { nullable: true })
  maxPrice?: number;
}

@ObjectType()
export class DiscoveredTrack {
  @Field()
  sourceArtist: string;

  @Field()
  sourceTitle: string;

  @Field({ nullable: true })
  sourceImagePath?: string;

  @Field()
  artist: string;

  @Field()
  title: string;

  @Field(() => Float)
  matchScore: number;

  @Field({ nullable: true })
  externalLink?: string;

  @Field({ nullable: true })
  videoId?: string;

  @Field()
  confidence: string;
}

@ObjectType()
export class CosineRecommendedTrack {
  @Field()
  artist: string;

  @Field()
  title: string;

  @Field(() => Float)
  score: number;

  @Field({ nullable: true })
  externalLink?: string;

  @Field({ nullable: true })
  videoId?: string;
}
