import { ServiceInstance } from 'src/application/ports/infrastructure/IAiServicePool';

export interface AssignedServers {
  simple: ServiceInstance | null;
  hierarchical: ServiceInstance | null;
}

export interface ServerAssignment {
  url: string;
  assignedTo: string;
  assignedAt: string;
  lastHeartbeat: string;
  serviceId: string;
}
