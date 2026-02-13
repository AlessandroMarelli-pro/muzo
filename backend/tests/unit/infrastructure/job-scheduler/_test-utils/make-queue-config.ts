import type { QueueConfig } from 'src/config';

export function makeQueueConfig(overrides: Partial<QueueConfig> = {}): QueueConfig {
  return {
    redis: {
      host: 'localhost',
      port: 6379,
      db: 0,
      ...overrides.redis,
    },
    queues: {
      libraryScan: {
        name: 'library-scan',
        concurrency: 1,
        attempts: 1,
        backoff: { type: 'exponential', delay: 2000 },
        ...overrides.queues?.libraryScan,
      },
      audioScan: {
        concurrency: 5,
        attempts: 1,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: false,
        removeOnFail: false,
        ...overrides.queues?.audioScan,
      },
      ...overrides.queues,
    },
    ...overrides,
  };
}
