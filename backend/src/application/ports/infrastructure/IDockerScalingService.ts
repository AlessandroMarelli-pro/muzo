import { createToken } from '../../utils/create-token';

export const DOCKER_SCALING_SERVICE = createToken<IDockerScalingService>('DOCKER_SCALING_SERVICE');

export interface IDockerScalingService {
  /**
   * Scales the `ai-service` compose service to exactly `replicas` running containers, via the
   * Docker Engine API over the mounted socket (compose CLI is not usable in-container -- its
   * project metadata points at host paths). New containers are stamped with the same
   * com.docker.compose.* labels and network alias a `docker compose up --scale` container would
   * get, so they stay visible to `docker compose ps`/`down` and to the pool's DNS-based
   * discovery (see AiServerPoolAdapter.resolveLocalInstanceUrls).
   */
  scaleAiService(replicas: number): Promise<void>;

  /**
   * Reads Docker Engine /info (NCPU, MemTotal) over the same socket and returns the largest
   * replica count this host can hold without oversubscribing ai-service's
   * WEB_CONCURRENCY*ANALYSIS_THREADS-per-replica CPU budget or its ~2-3 GB-per-worker memory
   * footprint. Always at least 1.
   */
  getMaxReplicas(): Promise<number>;
}
