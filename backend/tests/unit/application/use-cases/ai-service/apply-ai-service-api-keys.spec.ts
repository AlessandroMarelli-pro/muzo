import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplyAiServiceApiKeysUseCase } from 'src/application/use-cases/ai-service/ApplyAiServiceApiKeys';

const localSettings = {
  mode: 'local' as const,
  geminiApiKey: 'g',
  hfToken: null,
  lastfmApiKey: null,
  lastfmSecret: null,
  discogsApiKeys: null,
};

function make(overrides: {
  settings?: any;
  scanActive?: boolean;
  recreate?: () => Promise<boolean>;
}) {
  const settingsRepository = { get: vi.fn().mockResolvedValue(overrides.settings ?? localSettings) };
  const aiServicePool = { reload: vi.fn().mockResolvedValue(undefined) };
  const scanSessionRepository = {
    hasAnyActiveSession: vi.fn().mockResolvedValue(overrides.scanActive ?? false),
  };
  const dockerScalingService = {
    recreateAiServiceReplicas: vi
      .fn()
      .mockImplementation(overrides.recreate ?? (() => Promise.resolve(true))),
  };
  const useCase = new ApplyAiServiceApiKeysUseCase(
    settingsRepository as any,
    aiServicePool as any,
    scanSessionRepository as any,
    dockerScalingService as any,
  );
  return { useCase, aiServicePool, dockerScalingService };
}

describe('ApplyAiServiceApiKeysUseCase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recreates the local replicas with the mapped env and reloads the pool', async () => {
    const { useCase, aiServicePool, dockerScalingService } = make({});
    const result = await useCase.execute();

    expect(result.success).toBe(true);
    expect(dockerScalingService.recreateAiServiceReplicas).toHaveBeenCalledWith({ GOOGLE_API_KEY: 'g' });
    expect(aiServicePool.reload).toHaveBeenCalledOnce();
  });

  it('refuses in remote mode', async () => {
    const { useCase, dockerScalingService } = make({ settings: { mode: 'remote' } });
    const result = await useCase.execute();

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/only works in local mode/i);
    expect(dockerScalingService.recreateAiServiceReplicas).not.toHaveBeenCalled();
  });

  it('refuses while a scan is active', async () => {
    const { useCase, dockerScalingService } = make({ scanActive: true });
    const result = await useCase.execute();

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/scan is in progress/i);
    expect(dockerScalingService.recreateAiServiceReplicas).not.toHaveBeenCalled();
  });

  it('reports when there is no container to clone from', async () => {
    const { useCase, aiServicePool } = make({ recreate: () => Promise.resolve(false) });
    const result = await useCase.execute();

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/no local ai-service container/i);
    expect(aiServicePool.reload).not.toHaveBeenCalled();
  });

  it('surfaces an unreachable Docker socket as a friendly message', async () => {
    const { useCase } = make({
      recreate: () => Promise.reject(new Error('connect ENOENT /var/run/docker.sock')),
    });
    const result = await useCase.execute();

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Docker daemon/i);
  });
});
