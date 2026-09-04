import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class IntegrationSettings {
  // Whether each credential is stored -- never the value itself.
  @Field()
  hasCosineApiKey: boolean;

  @Field()
  hasSpotifyClientId: boolean;

  @Field()
  hasSpotifyClientSecret: boolean;

  @Field()
  hasTidalClientId: boolean;

  @Field()
  hasTidalClientSecret: boolean;

  @Field()
  hasYoutubeClientId: boolean;

  @Field()
  hasYoutubeClientSecret: boolean;
}

@ObjectType()
export class IntegrationSettingsActionResult {
  @Field()
  success: boolean;

  @Field()
  message: string;
}
