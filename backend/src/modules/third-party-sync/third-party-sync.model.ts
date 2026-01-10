import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SyncResult {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  playlistId?: string;

  @Field({ nullable: true })
  playlistUrl?: string;

  @Field()
  syncedCount: number;

  @Field()
  skippedCount: number;

  @Field(() => [String])
  errors: string[];
}

@ObjectType()
export class YouTubeAuthUrl {
  @Field()
  authUrl: string;
}

@ObjectType()
export class YouTubeAuthResult {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  message?: string;
}
