import { registerAs } from '@nestjs/config';

export interface AiServiceConfig {
  simpleUrls: string[];
  hierarchicalUrls: string[];
  timeout: number;
}

export default registerAs(
  'aiService',
  (): AiServiceConfig => ({
    simpleUrls: process.env.AI_SIMPLE_URLS
      ? process.env.AI_SIMPLE_URLS.split(',')
      : [process.env.AI_SERVICE_URL || 'http://localhost:4000'],
    hierarchicalUrls: process.env.AI_HIERARCHICAL_URLS
      ? process.env.AI_HIERARCHICAL_URLS.split(',')
      : [process.env.AI_SERVICE_URL || 'http://localhost:4000'],
    timeout: parseInt(process.env.AI_SERVICE_TIMEOUT || '90000', 10), // Reduced to 45s
  }),
);
