import { Inject, Injectable } from '@nestjs/common';
import { IDockerScalingService } from 'src/application/ports/infrastructure/IDockerScalingService';
import { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { DockerEngineApiClient } from './docker-engine-api.client';

const COMPOSE_SERVICE_NAME = 'ai-service';
const COMPOSE_PROJECT_LABEL = 'com.docker.compose.project';
const COMPOSE_SERVICE_LABEL = 'com.docker.compose.service';
const COMPOSE_CONTAINER_NUMBER_LABEL = 'com.docker.compose.container-number';
const COMPOSE_ONEOFF_LABEL = 'com.docker.compose.oneoff';

/** ~2.5 GB resident per gunicorn worker once its models are warm (see gunicorn.conf.py docstring). */
const APPROX_MEMORY_PER_WORKER_BYTES = 2.5 * 1024 * 1024 * 1024;

interface DockerContainerSummary {
  Id: string;
  Names: string[];
  Labels: Record<string, string>;
  Image: string;
  State: string; // "running" | "exited" | "created" | ...
}

interface DockerContainerInspect {
  Id: string;
  Config: { Image: string; Env: string[]; Labels: Record<string, string> };
  HostConfig: Record<string, unknown>;
  NetworkSettings: { Networks: Record<string, unknown> };
}

/**
 * Scales the `ai-service` compose service live, via the Docker Engine API over the socket
 * mounted into the backend container. `docker compose --scale` cannot run in-container: compose
 * tracks its project by the HOST path to docker-compose.yml (see a running container's
 * com.docker.compose.project.config_files label), which doesn't exist inside this container, and
 * the backend image ships no docker CLI. So replicas are created directly against the Engine API,
 * cloning Env/HostConfig from an existing ai-service container (rather than reconstructing
 * compose's create payload from scratch) so compose stays the single source of truth for how a
 * replica is configured.
 *
 * Caveat, stated rather than hidden: hand-made replicas can't carry compose's config-hash, so a
 * later plain `docker compose up -d` may recreate or remove them if it disagrees with what it
 * finds. Scaling through the app and through the CLI are not perfectly interchangeable.
 */
@Injectable()
export class DockerScalingService implements IDockerScalingService {
  private readonly logger: ILogger;

  constructor(
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly docker: DockerEngineApiClient,
  ) {
    this.logger = loggerFactory.createLogger('DockerScalingService');
  }

  async scaleAiService(replicas: number, envOverrides: Record<string, string> = {}): Promise<void> {
    const existing = await this.listAiServiceContainers();
    const running = existing.filter((c) => c.State === 'running');

    if (running.length === replicas) {
      this.logger.info(`ai-service already at ${replicas} replica(s), nothing to do`);
      return;
    }

    if (running.length < replicas) {
      await this.scaleUp(existing, replicas, envOverrides);
    } else {
      await this.scaleDown(running, replicas);
    }
  }

  async recreateAiServiceReplicas(envOverrides: Record<string, string>): Promise<boolean> {
    const existing = await this.listAiServiceContainers();
    if (existing.length === 0) {
      this.logger.warn('recreateAiServiceReplicas: no ai-service container to clone from');
      return false;
    }

    // Capture the template BEFORE tearing anything down -- once every replica is removed there is
    // nothing left to clone Env/HostConfig from.
    const templateSummary = existing.find((c) => c.State === 'running') ?? existing[0];
    const templateInspect = await this.docker.get<DockerContainerInspect>(
      `/containers/${templateSummary.Id}/json`,
    );
    const project = templateSummary.Labels[COMPOSE_PROJECT_LABEL];
    const networkName = Object.keys(templateInspect.NetworkSettings.Networks)[0];

    const runningCount = existing.filter((c) => c.State === 'running').length;
    const targetCount = Math.max(1, runningCount);

    // Remove every existing container (running or stopped) so container numbers restart cleanly.
    for (const container of existing) {
      this.logger.info(`Removing ai-service container ${container.Names[0]} for recreate`);
      if (container.State === 'running') {
        await this.docker.post(`/containers/${container.Id}/stop?t=30`);
      }
      await this.docker.delete(`/containers/${container.Id}`);
    }

    for (let i = 1; i <= targetCount; i++) {
      await this.createAndStartReplica(templateInspect, project, networkName, i, envOverrides);
    }

    this.logger.info(
      `Recreated ${targetCount} ai-service replica(s) with ${Object.keys(envOverrides).length} env override(s)`,
    );
    return true;
  }

  /** Merges `overrides` over a container's Env array: replaces any `KEY=` line, appends new keys. */
  private mergeEnv(env: string[], overrides: Record<string, string>): string[] {
    if (Object.keys(overrides).length === 0) return env;
    const overrideKeys = new Set(Object.keys(overrides));
    const kept = env.filter((line) => !overrideKeys.has(line.split('=', 1)[0]));
    return [...kept, ...Object.entries(overrides).map(([k, v]) => `${k}=${v}`)];
  }

  async getMaxReplicas(): Promise<number> {
    const info = await this.docker.get<{ NCPU: number; MemTotal: number }>('/info');

    // Each replica bakes WEB_CONCURRENCY workers (overridden to 1 for local mode -- see
    // docker-compose.yml's ai-service service); budget on that override, not the HF-sized
    // default, since that is what a local replica actually runs.
    const webConcurrencyPerReplica = 1;
    const cpuBound = Math.floor(info.NCPU / webConcurrencyPerReplica);
    const memoryBound = Math.floor(
      info.MemTotal / (webConcurrencyPerReplica * APPROX_MEMORY_PER_WORKER_BYTES),
    );

    return Math.max(1, Math.min(cpuBound, memoryBound));
  }

  private async listAiServiceContainers(): Promise<DockerContainerSummary[]> {
    const filters = encodeURIComponent(
      JSON.stringify({ label: [`${COMPOSE_SERVICE_LABEL}=${COMPOSE_SERVICE_NAME}`] }),
    );
    return this.docker.get<DockerContainerSummary[]>(`/containers/json?all=true&filters=${filters}`);
  }

  private async scaleUp(
    existing: DockerContainerSummary[],
    targetCount: number,
    envOverrides: Record<string, string> = {},
  ): Promise<void> {
    // Prefer a running container's config (freshest); fall back to any stopped one rather than
    // failing outright -- Env/HostConfig don't change just because a container is stopped.
    const template = existing.find((c) => c.State === 'running') ?? existing[0] ?? null;
    if (!template) {
      throw new Error(
        'Cannot scale up ai-service: no existing ai-service container to clone configuration from. ' +
          'Start the local-ai profile at least once first (docker compose --profile local-ai up -d ai-service).',
      );
    }

    const templateInspect = await this.docker.get<DockerContainerInspect>(
      `/containers/${template.Id}/json`,
    );
    const project = template.Labels[COMPOSE_PROJECT_LABEL];
    const networkName = Object.keys(templateInspect.NetworkSettings.Networks)[0];

    // Base new container numbers on every known container (running or stopped), not just the
    // running count, so a freshly created name never collides with one Docker hasn't removed yet.
    const usedContainerNumbers = existing.map((c) =>
      parseInt(c.Labels[COMPOSE_CONTAINER_NUMBER_LABEL] ?? '0', 10),
    );
    let nextContainerNumber = Math.max(0, ...usedContainerNumbers) + 1;
    const toCreate = targetCount - existing.filter((c) => c.State === 'running').length;

    for (let i = 0; i < toCreate; i++) {
      await this.createAndStartReplica(
        templateInspect,
        project,
        networkName,
        nextContainerNumber,
        envOverrides,
      );
      nextContainerNumber++;
    }
  }

  private async createAndStartReplica(
    templateInspect: DockerContainerInspect,
    project: string,
    networkName: string,
    containerNumber: number,
    envOverrides: Record<string, string> = {},
  ): Promise<void> {
    const name = `${project}-${COMPOSE_SERVICE_NAME}-${containerNumber}`;
    this.logger.info(`Creating ai-service replica ${name}`);

    const created = await this.docker.post<{ Id: string }>(
      `/containers/create?name=${encodeURIComponent(name)}`,
      {
        Image: templateInspect.Config.Image,
        Env: this.mergeEnv(templateInspect.Config.Env, envOverrides),
        HostConfig: templateInspect.HostConfig,
        Labels: {
          ...templateInspect.Config.Labels,
          [COMPOSE_PROJECT_LABEL]: project,
          [COMPOSE_SERVICE_LABEL]: COMPOSE_SERVICE_NAME,
          [COMPOSE_CONTAINER_NUMBER_LABEL]: String(containerNumber),
          [COMPOSE_ONEOFF_LABEL]: 'False',
        },
        NetworkingConfig: {
          EndpointsConfig: {
            [networkName]: {
              // The alias is what puts this replica into the ai-service DNS A-record set --
              // without it the container runs and is invisible to AiServerPoolAdapter's
              // dns.promises.resolve4('ai-service') discovery.
              Aliases: [COMPOSE_SERVICE_NAME],
            },
          },
        },
      },
    );

    await this.docker.post(`/containers/${created.Id}/start`);
  }

  private async scaleDown(running: DockerContainerSummary[], targetCount: number): Promise<void> {
    const byContainerNumber = [...running].sort((a, b) => {
      const numA = parseInt(a.Labels[COMPOSE_CONTAINER_NUMBER_LABEL] ?? '0', 10);
      const numB = parseInt(b.Labels[COMPOSE_CONTAINER_NUMBER_LABEL] ?? '0', 10);
      return numB - numA; // highest container-number first, so we remove the most recently added
    });

    const toRemove = byContainerNumber.slice(0, running.length - targetCount);
    for (const container of toRemove) {
      this.logger.info(`Removing ai-service replica ${container.Names[0]}`);
      await this.docker.post(`/containers/${container.Id}/stop?t=30`);
      await this.docker.delete(`/containers/${container.Id}`);
    }
  }
}
