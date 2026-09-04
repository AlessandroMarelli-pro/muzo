import { registerAs } from '@nestjs/config';

export interface AiServiceConfig {
  timeout: number;
  /**
   * Boot-time fallback only, consulted by the AiServiceSettings bootstrap use-case to seed the
   * first-ever settings row (remote mode, this URL/token) so an existing .env-configured install
   * keeps working unchanged. Once a settings row exists, the pool never reads these again --
   * AiServiceSettingsRepository is the source of truth.
   */
  bootstrapUrl?: string;
  bootstrapAuthToken?: string;
}

export default registerAs(
  'aiService',
  (): AiServiceConfig => ({
    timeout: parseInt(process.env.AI_SERVICE_TIMEOUT || '90000', 10),
    bootstrapUrl: process.env.AI_SERVICE_URL || undefined,
    bootstrapAuthToken: process.env.AI_SERVICE_TOKEN,
  }),
);
