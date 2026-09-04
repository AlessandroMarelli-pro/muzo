import { HttpException, HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import dns from 'dns';
import {
  AiServiceHealthInfo,
  AiServiceTarget,
  IAiServicePool,
  ServiceInstance,
} from 'src/application/ports/infrastructure/IAiServicePool';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import {
  AI_SERVICE_SETTINGS_REPOSITORY,
  IAiServiceSettingsRepository,
} from 'src/application/ports/repositories/IAiServiceSettingsRepository';
import { AiServiceConfig } from 'src/config';

/** Port the ai-service Flask app listens on inside the container (see ai-service/gunicorn.conf.py). */
const AI_SERVICE_PORT = 4000;

/**
 * Docker's embedded DNS resolves a compose service name to every replica's IP when the service
 * has more than one running container -- this is how local mode discovers replicas created by
 * live scaling (see DockerScalingService) without either side tracking container IDs.
 */
const LOCAL_AI_SERVICE_DNS_NAME = 'ai-service';

@Injectable()
export class AiServerPoolAdapter implements IAiServicePool, OnModuleInit {
  private readonly aiServiceConfig: AiServiceConfig;
  private instances: ServiceInstance[] = [];
  private authToken: string | undefined;
  /** Round-robin cursor into `instances`. */
  private nextIndex = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
    private readonly configService: ConfigService,
    @Inject(AI_SERVICE_SETTINGS_REPOSITORY)
    private readonly settingsRepository: IAiServiceSettingsRepository,
  ) {
    this.logger = loggerFactory.createLogger('AiServerPoolAdapter');
    this.aiServiceConfig = this.configService.get<AiServiceConfig>('aiService')!;
  }

  async onModuleInit(): Promise<void> {
    await this.seedSettingsFromEnvIfUnconfigured();
    await this.reload();
    this.startHealthChecking();
  }

  /**
   * Every existing install runs remote via AI_SERVICE_URL/AI_SERVICE_TOKEN in .env. The settings
   * table defaults to mode "remote" with a null remoteUrl (see schema.prisma), which is
   * indistinguishable from "never configured" -- so on first boot with a still-default row and an
   * env URL present, seed the row from env once. After that the settings UI is the only source of
   * truth; this never overwrites a row a user has actually saved.
   */
  private async seedSettingsFromEnvIfUnconfigured(): Promise<void> {
    const settings = await this.settingsRepository.get();
    const isUnconfigured = settings.mode === 'remote' && settings.remoteUrl === null;
    if (!isUnconfigured || !this.aiServiceConfig.bootstrapUrl) {
      return;
    }
    this.logger.info(`Seeding ai-service settings from AI_SERVICE_URL: ${this.aiServiceConfig.bootstrapUrl}`);
    await this.settingsRepository.save({
      mode: 'remote',
      remoteUrl: this.aiServiceConfig.bootstrapUrl,
      authToken: this.aiServiceConfig.bootstrapAuthToken ?? null,
    });
  }

  /**
   * Picks the next healthy instance round-robin and returns its URL plus auth headers. Returning
   * both together (rather than a bare URL) is what keeps a token change from going stale --
   * consumers no longer read a separately-captured config snapshot.
   */
  getTarget(): AiServiceTarget {
    const healthyInstances = this.instances.filter((instance) => instance.isHealthy);
    if (healthyInstances.length === 0) {
      throw new HttpException('No healthy ai-service instance available', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const instance = healthyInstances[this.nextIndex % healthyInstances.length];
    this.nextIndex = (this.nextIndex + 1) % healthyInstances.length;

    return { url: instance.url, headers: this.authHeaders() };
  }

  async getHealthInfo(): Promise<AiServiceHealthInfo> {
    return {
      overall: this.instances.some((instance) => instance.isHealthy),
      instances: this.instances.map((instance) => ({
        url: instance.url,
        isHealthy: instance.isHealthy,
        activeConnections: instance.activeConnections,
        lastChecked: instance.lastChecked,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Re-reads AiServiceSettings and rebuilds the instance list. Called on boot and after every
   * settings change (mode switch, URL/token edit, replica count change) so those apply live with
   * no backend restart -- the whole point of moving settings out of constructor-frozen env config.
   */
  async reload(): Promise<void> {
    const settings = await this.settingsRepository.get();
    this.authToken = settings.authToken ?? this.aiServiceConfig.bootstrapAuthToken;

    const urls =
      settings.mode === 'local'
        ? await this.resolveLocalInstanceUrls()
        : this.resolveRemoteInstanceUrls(settings.remoteUrl);

    const previousByUrl = new Map(this.instances.map((instance) => [instance.url, instance]));
    this.instances = urls.map((url) => {
      const previous = previousByUrl.get(url);
      // Keep a known-healthy instance's state across a reload; a brand new one (a freshly scaled
      // replica, or a URL just switched to) starts unhealthy -- it may still be cold-loading its
      // ~2-3 GB of models, and routing real analysis traffic at it before the health loop confirms
      // it is up would just fail the request.
      return (
        previous ?? {
          url,
          isHealthy: false,
          lastChecked: new Date(0),
          activeConnections: 0,
        }
      );
    });
    this.nextIndex = 0;

    this.logger.info(
      `ai-service pool reloaded: mode=${settings.mode} instances=${JSON.stringify(urls)}`,
    );

    // Confirm health immediately rather than waiting for the next 30s tick -- a mode switch or a
    // fresh scale-up should reflect in getHealthInfo()/the settings UI right away.
    await this.checkAllInstancesHealth();
  }

  private resolveRemoteInstanceUrls(remoteUrl: string | null): string[] {
    return remoteUrl ? [remoteUrl] : [];
  }

  private async resolveLocalInstanceUrls(): Promise<string[]> {
    try {
      const addresses = await dns.promises.resolve4(LOCAL_AI_SERVICE_DNS_NAME);
      return addresses.map((address) => `http://${address}:${AI_SERVICE_PORT}`);
    } catch (error: any) {
      // ENOTFOUND -- the ai-service compose profile isn't running (or DNS hasn't caught up with a
      // container that just started). Not an error worth logging at warn: this is the expected
      // state before `docker compose --profile local-ai up` has run.
      this.logger.info(`Could not resolve local ai-service instances: ${error.message}`);
      return [];
    }
  }

  private authHeaders(): Record<string, string> {
    return this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {};
  }

  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.checkAllInstancesHealth();
    }, 30000);
  }

  private async checkAllInstancesHealth(): Promise<void> {
    await Promise.allSettled(
      this.instances.map((instance) => this.checkInstanceHealth(instance)),
    );
  }

  private async checkInstanceHealth(instance: ServiceInstance): Promise<void> {
    try {
      const response = await axios.get(`${instance.url}/api/v1/health`, {
        timeout: 5000,
        headers: this.authHeaders(),
      });

      const wasHealthy = instance.isHealthy;
      instance.isHealthy = response.status === 200 && (response.data as any)?.status === 'healthy';
      instance.lastChecked = new Date();

      if (wasHealthy !== instance.isHealthy) {
        this.logger.info(
          `ai-service instance ${instance.url} health changed: ${instance.isHealthy ? 'healthy' : 'unhealthy'}`,
        );
      }
    } catch (error: any) {
      const wasHealthy = instance.isHealthy;
      instance.isHealthy = false;
      instance.lastChecked = new Date();

      if (wasHealthy) {
        this.logger.warn(`ai-service instance ${instance.url} became unhealthy: ${error.message}`);
      }
    }
  }

  onModuleDestroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}
