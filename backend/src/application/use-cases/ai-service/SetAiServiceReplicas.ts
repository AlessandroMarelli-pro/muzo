import { IAiServicePool } from 'src/application/ports/infrastructure/IAiServicePool';
import { IAiServiceSettingsRepository } from 'src/application/ports/repositories/IAiServiceSettingsRepository';
import { IScanSessionRepository } from 'src/application/ports/repositories/IScanSessionRepository';
import { IDockerScalingService } from 'src/application/ports/infrastructure/IDockerScalingService';
import { buildLocalAiEnvOverrides } from './buildLocalAiEnvOverrides';

export interface SetAiServiceReplicasInput {
  replicas: number;
}

export interface SetAiServiceReplicasResult {
  success: boolean;
  message: string;
}

/**
 * Scales the local ai-service compose service to the requested replica count. Blocked while any
 * scan is in flight, same reasoning as UpdateAiServiceSettings -- removing a replica mid-scan
 * would fail whatever batch was in flight on it. The requested count is clamped against what the
 * Docker host can actually hold (see IDockerScalingService.maxReplicas) rather than trusted
 * outright: on a small Docker Desktop VM the naive answer is 1, and letting the UI request more
 * would OOM the VM.
 */
export class SetAiServiceReplicasUseCase {
  constructor(
    private readonly settingsRepository: IAiServiceSettingsRepository,
    private readonly aiServicePool: IAiServicePool,
    private readonly scanSessionRepository: IScanSessionRepository,
    private readonly dockerScalingService: IDockerScalingService,
  ) {}

  async execute(input: SetAiServiceReplicasInput): Promise<SetAiServiceReplicasResult> {
    if (input.replicas < 1 || !Number.isInteger(input.replicas)) {
      return { success: false, message: 'Replica count must be a whole number of at least 1' };
    }

    if (await this.scanSessionRepository.hasAnyActiveSession()) {
      return {
        success: false,
        message: 'Cannot change ai-service replicas while a scan is in progress. Wait for it to finish.',
      };
    }

    const maxReplicas = await this.dockerScalingService.getMaxReplicas();
    if (input.replicas > maxReplicas) {
      return {
        success: false,
        message: `Requested ${input.replicas} replicas, but this host can only support ${maxReplicas} given its CPU/memory.`,
      };
    }

    // Carry any stored API keys onto freshly created replicas so a scale-up right after a
    // `docker compose up` doesn't leave the new container without them.
    const settings = await this.settingsRepository.get();
    await this.dockerScalingService.scaleAiService(
      input.replicas,
      buildLocalAiEnvOverrides(settings),
    );
    await this.settingsRepository.save({ replicas: input.replicas });
    await this.aiServicePool.reload();

    return { success: true, message: `Scaled ai-service to ${input.replicas} replica(s)` };
  }
}
