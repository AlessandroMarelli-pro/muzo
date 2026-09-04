import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import dns from 'dns';
import { AiServerPoolAdapter } from 'src/infrastructure/external-services/ai/ai-server-pool.adapter';
import { AiServiceSettings } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');
vi.mock('dns', () => ({
  default: { promises: { resolve4: vi.fn() } },
}));

const mockedAxiosGet = vi.mocked(axios.get);
const mockedResolve4 = vi.mocked(dns.promises.resolve4);

function healthyResponse() {
  return { status: 200, data: { status: 'healthy' } };
}

function baseSettings(overrides: Partial<AiServiceSettings> = {}): AiServiceSettings {
  return {
    id: models.aiServiceSettings.id('singleton'),
    mode: 'remote',
    remoteUrl: 'http://remote.example.com',
    authToken: 'initial-token',
    replicas: 1,
    createdAt: new Date(),
    createdById: models.user.id('userId'),
    updatedAt: new Date(),
    updatedById: undefined,
    ...overrides,
  };
}

function makeAdapter(settings: AiServiceSettings) {
  const loggerFactory = { createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) };
  const logger = loggerFactory.createLogger();
  const configService = {
    get: vi.fn().mockReturnValue({ timeout: 90000, bootstrapUrl: undefined, bootstrapAuthToken: undefined }),
  } as unknown as ConfigService;
  const settingsRepository = {
    get: vi.fn().mockResolvedValue(settings),
    save: vi.fn(),
  };

  const adapter = new AiServerPoolAdapter(loggerFactory, logger, configService, settingsRepository);
  return { adapter, settingsRepository };
}

describe('AiServerPoolAdapter', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('remote mode', () => {
    it('reload() picks up a changed token so the next target reflects it', async () => {
      mockedAxiosGet.mockResolvedValue(healthyResponse());
      const { adapter, settingsRepository } = makeAdapter(baseSettings({ authToken: 'old-token' }));

      await adapter.reload();
      expect(adapter.getTarget().headers).toEqual({ Authorization: 'Bearer old-token' });

      settingsRepository.get.mockResolvedValue(baseSettings({ authToken: 'new-token' }));
      await adapter.reload();

      expect(adapter.getTarget().headers).toEqual({ Authorization: 'Bearer new-token' });
    });

    it('throws 503 when the single remote instance is unhealthy', async () => {
      mockedAxiosGet.mockRejectedValue(new Error('ECONNREFUSED'));
      const { adapter } = makeAdapter(baseSettings());

      await adapter.reload();

      expect(() => adapter.getTarget()).toThrow('No healthy ai-service instance available');
    });
  });

  describe('local mode', () => {
    it('discovers replicas via DNS and round-robins across healthy ones', async () => {
      mockedResolve4.mockResolvedValue(['10.0.0.2', '10.0.0.3'] as any);
      mockedAxiosGet.mockResolvedValue(healthyResponse());
      const { adapter } = makeAdapter(baseSettings({ mode: 'local', remoteUrl: null }));

      await adapter.reload();

      const urls = [adapter.getTarget().url, adapter.getTarget().url, adapter.getTarget().url];
      expect(urls).toEqual([
        'http://10.0.0.2:4000',
        'http://10.0.0.3:4000',
        'http://10.0.0.2:4000',
      ]);
    });

    it('skips an unhealthy replica and only routes to the healthy one', async () => {
      mockedResolve4.mockResolvedValue(['10.0.0.2', '10.0.0.3'] as any);
      mockedAxiosGet.mockImplementation(async (url: unknown) => {
        if (typeof url === 'string' && url.includes('10.0.0.3')) {
          throw new Error('connect ECONNREFUSED');
        }
        return healthyResponse();
      });
      const { adapter } = makeAdapter(baseSettings({ mode: 'local', remoteUrl: null }));

      await adapter.reload();

      const urls = [adapter.getTarget().url, adapter.getTarget().url, adapter.getTarget().url];
      expect(urls).toEqual([
        'http://10.0.0.2:4000',
        'http://10.0.0.2:4000',
        'http://10.0.0.2:4000',
      ]);
    });

    it('resolves to no instances when the ai-service DNS name is not found', async () => {
      mockedResolve4.mockRejectedValue(Object.assign(new Error('not found'), { code: 'ENOTFOUND' }));
      const { adapter } = makeAdapter(baseSettings({ mode: 'local', remoteUrl: null }));

      await adapter.reload();

      expect(() => adapter.getTarget()).toThrow('No healthy ai-service instance available');
    });
  });
});
