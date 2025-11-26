import { registerAs } from '@nestjs/config';

export interface AiServiceConfig {
  simpleUrls: string[];
  hierarchicalUrls: string[];
  timeout: number;
  batchConcurrency: number;
  retryAttempts: number;
  retryDelay: number;
  connectionPoolTtl: number;
}

export default registerAs(
  'aiService',
  (): AiServiceConfig => ({
    simpleUrls: process.env.AI_SIMPLE_URLS
      ? process.env.AI_SIMPLE_URLS.split(',')
      : [
          'http://localhost:4000',
          'http://localhost:4001',
          'http://localhost:4002',
          'http://localhost:4003',
          'http://localhost:4004',
          'http://localhost:4005',
        ],
    hierarchicalUrls: process.env.AI_HIERARCHICAL_URLS
      ? process.env.AI_HIERARCHICAL_URLS.split(',')
      : [
          'http://localhost:4010',
          'http://localhost:4011',
          'http://localhost:4012',
          'http://localhost:4013',
          'http://localhost:4014',
          'http://localhost:4015',
        ],
    timeout: parseInt(process.env.AI_SERVICE_TIMEOUT || '45000', 10), // Reduced to 45s
    batchConcurrency: parseInt(process.env.AI_BATCH_CONCURRENCY || '5', 10),
    retryAttempts: parseInt(process.env.AI_RETRY_ATTEMPTS || '2', 2), // Increased retries
    retryDelay: parseInt(process.env.AI_RETRY_DELAY || '2000', 10), // Increased delay
    connectionPoolTtl: parseInt(
      process.env.AI_CONNECTION_POOL_TTL || '300',
      10,
    ), // 5 minutes
  }),
);
