import { Args, Field, InputType, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  GetIntegrationSettingsUseCase,
  UpdateIntegrationSettingsUseCase,
} from 'src/application/use-cases/integration-settings';
import {
  IntegrationSettings,
  IntegrationSettingsActionResult,
} from '../schema/integration-settings.schema';

@InputType()
class UpdateIntegrationSettingsGqlInput {
  /** Each field: omit to leave unchanged, pass "" to clear (falls back to env), a value to replace. */
  @Field({ nullable: true })
  cosineApiKey?: string;

  @Field({ nullable: true })
  spotifyClientId?: string;

  @Field({ nullable: true })
  spotifyClientSecret?: string;

  @Field({ nullable: true })
  tidalClientId?: string;

  @Field({ nullable: true })
  tidalClientSecret?: string;

  @Field({ nullable: true })
  youtubeClientId?: string;

  @Field({ nullable: true })
  youtubeClientSecret?: string;
}

@Resolver()
export class IntegrationSettingsResolver {
  constructor(
    private readonly getIntegrationSettingsUseCase: GetIntegrationSettingsUseCase,
    private readonly updateIntegrationSettingsUseCase: UpdateIntegrationSettingsUseCase,
  ) {}

  @Query(() => IntegrationSettings)
  async integrationSettings(): Promise<IntegrationSettings> {
    return this.getIntegrationSettingsUseCase.execute();
  }

  @Mutation(() => IntegrationSettingsActionResult)
  async updateIntegrationSettings(
    @Args('input') input: UpdateIntegrationSettingsGqlInput,
  ): Promise<IntegrationSettingsActionResult> {
    return this.updateIntegrationSettingsUseCase.execute(input);
  }
}
