import { ConfigModule } from '@nestjs/config';
import aiServiceConfig from './ai-service.config';
import appConfig from './app.config';
import authConfig from './auth.config';
import databaseConfig from './database.config';
import elasticsearchConfig from './elasticsearch.config';
import queueConfig from './queue.config';

export const ConfigModuleSetup = ConfigModule.forRoot({
  isGlobal: true,
  load: [databaseConfig, aiServiceConfig, appConfig, authConfig, queueConfig, elasticsearchConfig],
  envFilePath: ['.env.local', '.env'],
  cache: true,
});

export type { AiServiceConfig } from './ai-service.config';
export type { AppConfig } from './app.config';
export type { AuthConfig } from './auth.config';
export type { DatabaseConfig } from './database.config';
export type { QueueConfig } from './queue.config';
export { aiServiceConfig, appConfig, authConfig, databaseConfig, elasticsearchConfig, queueConfig };
