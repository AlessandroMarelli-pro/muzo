import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateAiServiceApiKeysUseCase } from 'src/application/use-cases/ai-service/UpdateAiServiceApiKeys';

function make(mode: 'local' | 'remote' = 'remote') {
  const save = vi.fn().mockResolvedValue(undefined);
  const get = vi.fn().mockResolvedValue({ mode });
  const useCase = new UpdateAiServiceApiKeysUseCase({ save, get } as any);
  return { useCase, save };
}

describe('UpdateAiServiceApiKeysUseCase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('only forwards the fields that were provided (tri-state)', async () => {
    const { useCase, save } = make();
    await useCase.execute({ geminiApiKey: 'g', hfToken: '' });

    expect(save).toHaveBeenCalledWith({ geminiApiKey: 'g', hfToken: '' });
    // untouched keys are absent, not null -> repository leaves them unchanged
    expect(save.mock.calls[0][0]).not.toHaveProperty('discogsApiKeys');
  });

  it('gives a local-mode message when stored mode is local', async () => {
    const { useCase } = make('local');
    const result = await useCase.execute({ geminiApiKey: 'g' });

    expect(result.success).toBe(true);
    expect(result.message).toMatch(/Apply to running container/i);
  });

  it('gives a remote-mode message when stored mode is remote', async () => {
    const { useCase } = make('remote');
    const result = await useCase.execute({ geminiApiKey: 'g' });

    expect(result.success).toBe(true);
    expect(result.message).toMatch(/remote mode/i);
  });
});
