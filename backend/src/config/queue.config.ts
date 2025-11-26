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
      name: string;
      concurrency: number;
      attempts: number;
      backoff: {
        type: string;
        delay: number;
      };
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
        concurrency: parseInt(process.env.LIBRARY_SCAN_CONCURRENCY || '3', 10),
        attempts: parseInt(process.env.LIBRARY_SCAN_ATTEMPTS || '2', 10),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.LIBRARY_SCAN_BACKOFF_DELAY || '2000', 10),
        },
      },
      audioScan: {
        name: 'audio-scan',
        concurrency: parseInt(process.env.AUDIO_SCAN_CONCURRENCY || '5', 10),
        attempts: parseInt(process.env.AUDIO_SCAN_ATTEMPTS || '2', 10),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.AUDIO_SCAN_BACKOFF_DELAY || '1000', 10),
        },
      },
    },
  }),
);
