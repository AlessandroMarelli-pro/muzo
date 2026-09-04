import { IAiServicePool } from 'src/application/ports/infrastructure/IAiServicePool';
import { IDockerScalingService } from 'src/application/ports/infrastructure/IDockerScalingService';
import { IAiServiceSettingsRepository } from 'src/application/ports/repositories/IAiServiceSettingsRepository';
import { IScanSessionRepository } from 'src/application/ports/repositories/IScanSessionRepository';
import { buildLocalAiEnvOverrides } from './buildLocalAiEnvOverrides';

export interface ApplyAiServiceApiKeysResult {
  success: boolean;
  message: string;
}

/**
 * Recreates the local ai-service replica(s) so the stored API keys take effect -- a container's
 * env is fixed at create time, so there is no in-place update. Blocked while any scan is active
 * (it stops running containers), same reasoning as UpdateAiServiceSettings / SetAiServiceReplicas.
 * Local mode only: a remote endpoint reads its own env.
 */
export class ApplyAiServiceApiKeysUseCase {
  constructor(
    private readonly settingsRepository: IAiServiceSettingsRepository,
    private readonly aiServicePool: IAiServicePool,
    private readonly scanSessionRepository: IScanSessionRepository,
    private readonly dockerScalingService: IDockerScalingService,
  ) {}

  async execute(): Promise<ApplyAiServiceApiKeysResult> {
    const settings = await this.settingsRepository.get();

    if (settings.mode !== 'local') {
      return {
        success: false,
        message: 'Applying API keys only works in local mode. A remote endpoint uses its own environment.',
      };
    }

    if (await this.scanSessionRepository.hasAnyActiveSession()) {
      return {
        success: false,
        message: 'Cannot apply API keys while a scan is in progress. Wait for it to finish.',
      };
    }

    const overrides = buildLocalAiEnvOverrides(settings);

    let recreated: boolean;
    try {
      recreated = await this.dockerScalingService.recreateAiServiceReplicas(overrides);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('ENOENT') && message.includes('docker.sock')) {
        return {
          success: false,
          message:
            "Can't reach the Docker daemon. Local-mode key injection needs the backend to run with the Docker socket mounted (see docker-compose.yml).",
        };
      }
      return { success: false, message: `Failed to recreate the local ai-service: ${message}` };
    }

    if (!recreated) {
      return {
        success: false,
        message:
          'No local ai-service container is running. Start it with `docker compose --profile local-ai up -d ai-service`, then apply again.',
      };
    }

    await this.aiServicePool.reload();

    return {
      success: true,
      message:
        "Applied to the local ai-service. It'll be healthy again once the analysis models reload (~30-60s).",
    };
  }
}
