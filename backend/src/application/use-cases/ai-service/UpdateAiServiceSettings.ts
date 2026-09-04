import { IAiServicePool } from 'src/application/ports/infrastructure/IAiServicePool';
import { IAiServiceSettingsRepository } from 'src/application/ports/repositories/IAiServiceSettingsRepository';
import { IScanSessionRepository } from 'src/application/ports/repositories/IScanSessionRepository';
import { AiServiceMode } from 'src/kernel/types/model-types';
import { TestAiServiceConnectionUseCase } from './TestAiServiceConnection';

export interface UpdateAiServiceSettingsInput {
  mode: AiServiceMode;
  remoteUrl?: string | null;
  /** undefined = leave the stored token unchanged; null/"" = clear it; a string = replace it. */
  authToken?: string | null;
}

export interface UpdateAiServiceSettingsResult {
  success: boolean;
  message: string;
}

/**
 * Switches ai-service mode/URL/token. Blocked while any scan is in flight (see
 * IScanSessionRepository.hasAnyActiveSession) -- yanking the endpoint out from under running
 * analysis jobs would fail in-flight batches or route them at a cold replica. A remote switch is
 * re-probed here (not just trusted from an earlier "Test connection" click) so a config that
 * fails its health check is never persisted; the pool is reloaded immediately after a successful
 * save so the switch takes effect with no backend restart.
 */
export class UpdateAiServiceSettingsUseCase {
  constructor(
    private readonly settingsRepository: IAiServiceSettingsRepository,
    private readonly aiServicePool: IAiServicePool,
    private readonly scanSessionRepository: IScanSessionRepository,
    private readonly testConnectionUseCase: TestAiServiceConnectionUseCase,
  ) {}

  async execute(input: UpdateAiServiceSettingsInput): Promise<UpdateAiServiceSettingsResult> {
    if (await this.scanSessionRepository.hasAnyActiveSession()) {
      return {
        success: false,
        message: 'Cannot change the ai-service endpoint while a scan is in progress. Wait for it to finish.',
      };
    }

    if (input.mode === 'remote') {
      const url = (input.remoteUrl ?? '').trim();
      if (!url) {
        return { success: false, message: 'A remote URL is required for remote mode' };
      }

      const probe = await this.testConnectionUseCase.execute({
        url,
        authToken: input.authToken,
      });
      if (!probe.success) {
        return { success: false, message: `Connection check failed: ${probe.message}` };
      }
    }

    await this.settingsRepository.save({
      mode: input.mode,
      remoteUrl: input.mode === 'remote' ? (input.remoteUrl ?? null) : null,
      authToken: input.authToken,
    });
    await this.aiServicePool.reload();

    return { success: true, message: `Switched to ${input.mode} ai-service` };
  }
}
