import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AiServiceInstanceHealth {
  @Field()
  url: string;

  @Field()
  isHealthy: boolean;

  @Field(() => Int)
  activeConnections: number;

  @Field()
  lastChecked: Date;
}

@ObjectType()
export class AiServiceHealth {
  @Field()
  overall: boolean;

  @Field(() => [AiServiceInstanceHealth])
  instances: AiServiceInstanceHealth[];

  @Field()
  timestamp: string;
}

@ObjectType()
export class AiServiceSettings {
  @Field()
  mode: string; // "local" | "remote"

  @Field({ nullable: true })
  remoteUrl?: string;

  /** Whether a token is stored -- never the token itself, the UI can't read a secret back. */
  @Field()
  hasAuthToken: boolean;

  @Field(() => Int)
  replicas: number;

  // Whether each third-party API key is stored -- never the value itself.
  @Field()
  hasGeminiApiKey: boolean;

  @Field()
  hasHfToken: boolean;

  @Field()
  hasLastfmApiKey: boolean;

  @Field()
  hasLastfmSecret: boolean;

  @Field()
  hasDiscogsApiKeys: boolean;

  @Field(() => AiServiceHealth)
  health: AiServiceHealth;
}

@ObjectType()
export class AiServiceActionResult {
  @Field()
  success: boolean;

  @Field()
  message: string;
}
