import { createToken } from '../../utils/create-token';

export interface ServiceInstance {
  backendPort: number;
  url: string;
  isHealthy: boolean;
  lastChecked: Date;
  activeConnections: number;
}

export const AI_SERVICE_POOL = createToken<IAiServicePool>('AI_SERVICE_POOL');

export interface IAiServicePool {
  getAssignedServer(type: 'simple' | 'hierarchical'): ServiceInstance;
  getHealthInfo(): Promise<any>;
}
