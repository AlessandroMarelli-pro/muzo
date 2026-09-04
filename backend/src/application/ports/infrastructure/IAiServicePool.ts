import { createToken } from '../../utils/create-token';

export interface ServiceInstance {
  url: string;
  isHealthy: boolean;
  lastChecked: Date;
  activeConnections: number;
}

/** A resolved ai-service target: where to send the request and how to authenticate it. */
export interface AiServiceTarget {
  url: string;
  headers: Record<string, string>;
}

export interface AiServiceInstanceHealth {
  url: string;
  isHealthy: boolean;
  activeConnections: number;
  lastChecked: Date;
}

export interface AiServiceHealthInfo {
  overall: boolean;
  instances: AiServiceInstanceHealth[];
  timestamp: string;
}

export const AI_SERVICE_POOL = createToken<IAiServicePool>('AI_SERVICE_POOL');

export interface IAiServicePool {
  /**
   * Picks the next healthy ai-service instance (round-robin) and returns its URL plus the
   * headers to send with it (auth included). Throws HttpException(503) if none are healthy.
   */
  getTarget(): AiServiceTarget;

  getHealthInfo(): Promise<AiServiceHealthInfo>;

  /**
   * Re-reads AiServiceSettings and rebuilds the instance list -- remote mode resolves to the
   * single configured URL, local mode resolves the `ai-service` compose service's DNS A-records
   * to enumerate live replicas. Call after any settings change so mode/URL/token/replica
   * switches take effect without a backend restart.
   */
  reload(): Promise<void>;
}
