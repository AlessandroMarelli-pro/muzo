import { registerAs } from '@nestjs/config';

export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  queues: {
    libraryScan: {
      name: string;
      concurrency: number;
      attempts: number;
      backoff: {
        type: string;
        delay: number;
      };
    };
    audioScan: {
      concurrency: number;
      attempts: number;
      backoff: {
        type: string;
        delay: number;
      };
      removeOnComplete: boolean;
      removeOnFail: boolean;
    };
    hqAudioAcquire: {
      attempts: number;
      backoff: {
        type: string;
        delay: number;
      };
      removeOnComplete: boolean;
      removeOnFail: boolean;
    };
    hqAudioBatchAcquire: {
      /** Documentation only: actual worker concurrency is hardcoded on the @Processor decorator. */
      concurrency: number;
      attempts: number;
      backoff: {
        type: string;
        delay: number;
      };
      removeOnComplete: boolean;
      removeOnFail: boolean;
    };
    embeddingBackfill: {
      /**
       * Documentation only: actual worker concurrency is read from EMBEDDING_BACKFILL_CONCURRENCY
       * directly in embedding-backfill-consumer.adapter.ts, since @Processor's worker-options
       * argument is evaluated at class-definition time, before ConfigService is available.
       */
      concurrency: number;
      attempts: number;
      backoff: {
        type: string;
        delay: number;
      };
      removeOnComplete: boolean;
      removeOnFail: boolean;
    };
  };
}

export default registerAs(
  'queue',
  (): QueueConfig => ({
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    },
    queues: {
      libraryScan: {
        name: 'library-scan',
        concurrency: parseInt(process.env.LIBRARY_SCAN_CONCURRENCY || '1', 10),
        attempts: parseInt(process.env.LIBRARY_SCAN_ATTEMPTS || '1', 10),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.LIBRARY_SCAN_BACKOFF_DELAY || '2000', 10),
        },
      },
      audioScan: {
        concurrency: parseInt(process.env.AUDIO_SCAN_CONCURRENCY || '5', 10),
        attempts: parseInt(process.env.AUDIO_SCAN_ATTEMPTS || '1', 10),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.AUDIO_SCAN_BACKOFF_DELAY || '1000', 10),
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
      hqAudioAcquire: {
        attempts: parseInt(process.env.HQ_AUDIO_ACQUIRE_ATTEMPTS || '2', 10),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.HQ_AUDIO_ACQUIRE_BACKOFF_DELAY || '3000', 10),
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
      hqAudioBatchAcquire: {
        concurrency: parseInt(process.env.HQ_AUDIO_BATCH_ACQUIRE_CONCURRENCY || '5', 10),
        attempts: parseInt(process.env.HQ_AUDIO_BATCH_ACQUIRE_ATTEMPTS || '2', 10),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.HQ_AUDIO_BATCH_ACQUIRE_BACKOFF_DELAY || '3000', 10),
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
      embeddingBackfill: {
        concurrency: parseInt(process.env.EMBEDDING_BACKFILL_CONCURRENCY || '8', 10),
        attempts: parseInt(process.env.EMBEDDING_BACKFILL_ATTEMPTS || '2', 10),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.EMBEDDING_BACKFILL_BACKOFF_DELAY || '2000', 10),
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
    },
  }),
);
