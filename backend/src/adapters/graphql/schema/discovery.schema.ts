import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DiscoveredTrack {
  @Field()
  sourceArtist: string;

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
