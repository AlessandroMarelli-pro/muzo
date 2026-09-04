import { Args, Field, InputType, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  GetAiServiceSettingsUseCase,
  SetAiServiceReplicasUseCase,
  TestAiServiceConnectionUseCase,
  UpdateAiServiceSettingsUseCase,
} from 'src/application/use-cases/ai-service';
import { AiServiceMode } from 'src/kernel/types/model-types';
import { AiServiceActionResult, AiServiceSettings } from '../schema/ai-service-settings.schema';

@InputType()
class UpdateAiServiceSettingsGqlInput {
  @Field()
  mode: string; // "local" | "remote"

  @Field({ nullable: true })
  remoteUrl?: string;

  /** Omit to leave the stored token unchanged; pass "" to clear it. */
  @Field({ nullable: true })
  authToken?: string;
}

@InputType()
class TestAiServiceConnectionGqlInput {
  @Field()
  url: string;

  @Field({ nullable: true })
  authToken?: string;
}

@Resolver()
export class AiServiceSettingsResolver {
  constructor(
    private readonly getAiServiceSettingsUseCase: GetAiServiceSettingsUseCase,
    private readonly updateAiServiceSettingsUseCase: UpdateAiServiceSettingsUseCase,
    private readonly testAiServiceConnectionUseCase: TestAiServiceConnectionUseCase,
    private readonly setAiServiceReplicasUseCase: SetAiServiceReplicasUseCase,
  ) {}

  @Query(() => AiServiceSettings)
  async aiServiceSettings(): Promise<AiServiceSettings> {
    const settings = await this.getAiServiceSettingsUseCase.execute();
    return { ...settings, remoteUrl: settings.remoteUrl ?? undefined };
  }

  @Mutation(() => AiServiceActionResult)
  async testAiServiceConnection(
    @Args('input') input: TestAiServiceConnectionGqlInput,
  ): Promise<AiServiceActionResult> {
    return this.testAiServiceConnectionUseCase.execute(input);
  }

  @Mutation(() => AiServiceActionResult)
  async updateAiServiceSettings(
    @Args('input') input: UpdateAiServiceSettingsGqlInput,
  ): Promise<AiServiceActionResult> {
    return this.updateAiServiceSettingsUseCase.execute({
      mode: input.mode as AiServiceMode,
      remoteUrl: input.remoteUrl,
      authToken: input.authToken,
    });
  }

  @Mutation(() => AiServiceActionResult)
  async setAiServiceReplicas(
    @Args('replicas', { type: () => Int }) replicas: number,
  ): Promise<AiServiceActionResult> {
    return this.setAiServiceReplicasUseCase.execute({ replicas });
  }
}
