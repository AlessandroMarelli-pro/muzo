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

@ObjectType()
export class TidalAuthUrl {
  @Field()
  authUrl: string;

  @Field()
  codeVerifier: string; // Required for PKCE flow
}

@ObjectType()
export class TidalAuthResult {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType()
export class SpotifyAuthUrl {
  @Field()
  authUrl: string;

  @Field()
  codeVerifier: string; // Required for PKCE flow
}

@ObjectType()
export class SpotifyAuthResult {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  message?: string;
}
