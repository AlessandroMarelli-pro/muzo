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
  scaleAiService(replicas: number, envOverrides?: Record<string, string>): Promise<void>;

  /**
   * Stops and recreates every local `ai-service` replica so a changed environment (e.g. API keys
   * pasted in Settings) takes effect -- a container's Env is fixed at create time, so an
   * in-place update is not possible. `envOverrides` is merged over each replica's cloned Env
   * (keys replaced, new keys appended). Returns `false` and does nothing if there is no existing
   * `ai-service` container to clone from -- the caller should tell the user to start the
   * local-ai profile first. The replica count is preserved.
   */
  recreateAiServiceReplicas(envOverrides: Record<string, string>): Promise<boolean>;

  /**
   * Reads Docker Engine /info (NCPU, MemTotal) over the same socket and returns the largest
   * replica count this host can hold without oversubscribing ai-service's
   * WEB_CONCURRENCY*ANALYSIS_THREADS-per-replica CPU budget or its ~2-3 GB-per-worker memory
   * footprint. Always at least 1.
   */
  getMaxReplicas(): Promise<number>;
}
