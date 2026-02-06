export enum HEALTH_STATUS {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
}

export interface HealthInfo {
  status: HEALTH_STATUS;
  timestamp: number;
  database: {
    connected: boolean;
    status: HEALTH_STATUS;
    provider: string;
  };
}
