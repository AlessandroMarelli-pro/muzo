import { Field, Float, ObjectType } from '@nestjs/graphql';

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
