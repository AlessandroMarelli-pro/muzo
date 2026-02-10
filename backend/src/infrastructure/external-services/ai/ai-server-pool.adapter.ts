import { InjectQueue } from '@nestjs/bullmq';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Queue } from 'bullmq';
import {
  IAiServicePool,
  ServiceInstance,
} from 'src/application/ports/infrastructure/IAiServicePool';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { AiServiceConfig } from 'src/config';
import { AssignedServers, ServerAssignment } from './ai-server-pool.types';

@Injectable()
export class AiServerPoolAdapter implements IAiServicePool {
  private readonly aiServiceConfig: AiServiceConfig;
  private readonly simpleInstances: ServiceInstance[] = [];
  private readonly hierarchicalInstances: ServiceInstance[] = [];
  private readonly assignedServers: AssignedServers = {
    simple: null,
    hierarchical: null,
  };
  private readonly assignmentKey = 'ai-service:assignments';
  private readonly serviceId =
    process.env.HOSTNAME || `muzo-backend-${Date.now()}`;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
    private readonly configService: ConfigService,
    @InjectQueue('library-scan') private readonly queue: Queue,
  ) {
    this.logger = loggerFactory.createLogger('AiServerPoolAdapter');
    // Get AI service configuration from centralized config
    this.aiServiceConfig = this.configService.get<AiServiceConfig>('aiService');

    // Initialize service instances
    this.initializeServiceInstances();

    // Assign servers at startup
    this.assignServersAtStartup();

    // Start health checking
    this.startHealthChecking();

    // Start heartbeat for assigned servers
    this.startHeartbeat();

    this.logger.info(
      `AI Integration Service initialized with ${this.simpleInstances.length} simple instances and ${this.hierarchicalInstances.length} hierarchical instances`,
    );
  }

  /**
   * Get assigned server for a specific type
   */
  getAssignedServer(type: 'simple' | 'hierarchical'): ServiceInstance {
    const server = this.assignedServers[type];
    if (!server) {
      throw new HttpException(
        `No ${type} server assigned or available`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return server;
  }

  /**
   * Get AI service health information
   *
   * @returns Promise<any> - Health information from all service instances
   */
  async getHealthInfo(): Promise<any> {
    const stats = await this.getConnectionPoolStats();
    return {
      overall: await this.checkHealth(),
      instances: stats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Initialize service instances from configuration
   */
  private initializeServiceInstances(): void {
    const ports = [3000, 3002, 3003, 3004, 3005, 3006];
    // Initialize simple service instances
    this.aiServiceConfig.simpleUrls.forEach((url, index) => {
      this.simpleInstances.push({
        backendPort: ports[index],
        url,
        isHealthy: true,
        lastChecked: new Date(),
        activeConnections: 0,
      });
    });

    // Initialize hierarchical service instances
    this.aiServiceConfig.hierarchicalUrls.forEach((url, index) => {
      this.hierarchicalInstances.push({
        backendPort: ports[index],
        url,
        isHealthy: true,
        lastChecked: new Date(),
        activeConnections: 0,
      });
    });
  }

  /**
   * Assign servers at startup using Redis-based coordination
   */
  private async assignServersAtStartup(): Promise<void> {
    this.logger.info(
      `Assigning servers at startup for service: ${this.serviceId}`,
    );

    // Check health of all instances first
    await this.checkAllInstancesHealth();

    // Try to assign simple server
    await this.tryAssignServer('simple');

    // Try to assign hierarchical server
    await this.tryAssignServer('hierarchical');

    this.logger.info(
      `Server assignment completed - Simple: ${this.assignedServers.simple?.url || 'none'}, Hierarchical: ${this.assignedServers.hierarchical?.url || 'none'}`,
    );
  }

  /**
   * Try to assign a server of the specified type using Redis coordination
   */
  private async tryAssignServer(
    type: 'simple' | 'hierarchical',
  ): Promise<void> {
    const instances =
      type === 'simple' ? this.simpleInstances : this.hierarchicalInstances;
    const healthyInstances = instances.filter((instance) => instance.isHealthy);

    if (healthyInstances.length === 0) {
      this.logger.warn(`No healthy ${type} servers available`);
      return;
    }

    const currentPort = parseInt(process.env.PORT || '3000', 10);
    // Try to assign each healthy instance until one succeeds
    for (const instance of healthyInstances) {
      if (await this.reserveServer(instance.url, type)) {
        this.assignedServers[type] = instance;
        this.logger.info(
          `Successfully assigned ${type} server: ${instance.url}`,
        );
        return;
      }
    }
    const serverByPort = instances.find(
      (instance) => instance.backendPort === currentPort,
    );

    if (serverByPort) {
      this.assignedServers[type] = serverByPort;
      this.logger.info(
        `Successfully assigned ${type} server: ${serverByPort.url}`,
      );
      return;
    }

    this.logger.warn(
      `Could not assign any ${type} server - all are taken by other services`,
    );
  }

  /**
   * Reserve a server using Redis atomic operations
   */
  private async reserveServer(
    url: string,
    type: 'simple' | 'hierarchical',
  ): Promise<boolean> {
    try {
      const redis = await this.queue.client;
      const lockKey = `${this.assignmentKey}:${type}:${url}`;
      const assignment: ServerAssignment = {
        url,
        assignedTo: this.serviceId,
        assignedAt: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
        serviceId: this.serviceId,
      };

      // Use SET with NX (only if not exists) and EX (expiration) for atomic reservation
      const result = await redis.set(
        lockKey,
        JSON.stringify(assignment),
        'EX',
        30, // 30 seconds expiration
        'NX', // Only set if not exists
      );

      return result === 'OK';
    } catch (error) {
      this.logger.error(`Failed to reserve server ${url}:`, error);
      return false;
    }
  }

  /**
   * Release a server assignment
   */
  private async releaseServer(
    url: string,
    type: 'simple' | 'hierarchical',
  ): Promise<void> {
    try {
      const redis = await this.queue.client;
      const lockKey = `${this.assignmentKey}:${type}:${url}`;
      await redis.del(lockKey);
      this.logger.info(`Released ${type} server: ${url}`);
    } catch (error) {
      this.logger.error(`Failed to release server ${url}:`, error);
    }
  }

  /**
   * Start heartbeat mechanism to maintain server assignments
   */
  private startHeartbeat(): void {
    // Send heartbeat every 10 seconds
    this.heartbeatInterval = setInterval(async () => {
      await this.sendHeartbeat();
    }, 10000);

    // Initial heartbeat
    this.sendHeartbeat();
  }

  /**
   * Send heartbeat for assigned servers
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      const redis = await this.queue.client;
      const now = new Date().toISOString();

      // Update heartbeat for simple server
      if (this.assignedServers.simple) {
        const lockKey = `${this.assignmentKey}:simple:${this.assignedServers.simple.url}`;
        const existingAssignment = await redis.get(lockKey);

        if (existingAssignment) {
          const assignment: ServerAssignment = JSON.parse(existingAssignment);
          assignment.lastHeartbeat = now;
          await redis.setex(lockKey, 30, JSON.stringify(assignment));
        }
      }

      // Update heartbeat for hierarchical server
      if (this.assignedServers.hierarchical) {
        const lockKey = `${this.assignmentKey}:hierarchical:${this.assignedServers.hierarchical.url}`;
        const existingAssignment = await redis.get(lockKey);

        if (existingAssignment) {
          const assignment: ServerAssignment = JSON.parse(existingAssignment);
          assignment.lastHeartbeat = now;
          await redis.setex(lockKey, 30, JSON.stringify(assignment));
        }
      }
    } catch (error) {
      this.logger.error('Failed to send heartbeat:', error);
    }
  }

  /**
   * Check for expired assignments and reassign if needed
   */
  private async checkExpiredAssignments(): Promise<void> {
    try {
      const redis = await this.queue.client;
      const now = new Date();

      // Check simple server assignment
      if (this.assignedServers.simple) {
        const lockKey = `${this.assignmentKey}:simple:${this.assignedServers.simple.url}`;
        const assignment = await redis.get(lockKey);

        if (!assignment) {
          // Assignment expired, try to reassign
          this.logger.info(
            `Simple server assignment expired, attempting reassignment`,
          );
          this.assignedServers.simple = null;
          await this.tryAssignServer('simple');
        }
      }

      // Check hierarchical server assignment
      if (this.assignedServers.hierarchical) {
        const lockKey = `${this.assignmentKey}:hierarchical:${this.assignedServers.hierarchical.url}`;
        const assignment = await redis.get(lockKey);

        if (!assignment) {
          // Assignment expired, try to reassign
          this.logger.info(
            `Hierarchical server assignment expired, attempting reassignment`,
          );
          this.assignedServers.hierarchical = null;
          await this.tryAssignServer('hierarchical');
        }
      }
    } catch (error) {
      this.logger.error('Failed to check expired assignments:', error);
    }
  }

  /**
   * Reassign servers if current assignments become unhealthy
   */
  private async reassignServersIfNeeded(): Promise<void> {
    // Check if simple server needs reassignment
    if (this.assignedServers.simple && !this.assignedServers.simple.isHealthy) {
      this.logger.info(
        `Simple server ${this.assignedServers.simple.url} became unhealthy, releasing assignment`,
      );
      await this.releaseServer(this.assignedServers.simple.url, 'simple');
      this.assignedServers.simple = null;
      await this.tryAssignServer('simple');
    }

    // Check if hierarchical server needs reassignment
    if (
      this.assignedServers.hierarchical &&
      !this.assignedServers.hierarchical.isHealthy
    ) {
      this.logger.info(
        `Hierarchical server ${this.assignedServers.hierarchical.url} became unhealthy, releasing assignment`,
      );
      await this.releaseServer(
        this.assignedServers.hierarchical.url,
        'hierarchical',
      );
      this.assignedServers.hierarchical = null;
      await this.tryAssignServer('hierarchical');
    }

    // Try to assign servers if we don't have any assigned
    if (!this.assignedServers.simple) {
      await this.tryAssignServer('simple');
    }
    if (!this.assignedServers.hierarchical) {
      await this.tryAssignServer('hierarchical');
    }
  }

  /**
   * Start periodic health checking for all service instances
   */
  private startHealthChecking(): void {
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      await this.checkAllInstancesHealth();
      await this.checkExpiredAssignments();
      await this.reassignServersIfNeeded();
    }, 30000);

    // Initial health check
    this.checkAllInstancesHealth();
  }

  /**
   * Check health of all service instances
   */
  private async checkAllInstancesHealth(): Promise<void> {
    const healthChecks = [
      ...this.simpleInstances.map((instance) =>
        this.checkInstanceHealth(instance, 'simple'),
      ),
      ...this.hierarchicalInstances.map((instance) =>
        this.checkInstanceHealth(instance, 'hierarchical'),
      ),
    ];

    await Promise.allSettled(healthChecks);
  }

  /**
   * Check health of a specific service instance
   */
  private async checkInstanceHealth(
    instance: ServiceInstance,
    type: string,
  ): Promise<void> {
    try {
      const response = await axios.get(`${instance.url}/api/v1/health`, {
        timeout: 5000,
      });

      const wasHealthy = instance.isHealthy;
      instance.isHealthy =
        response.status === 200 && (response.data as any)?.status === 'healthy';
      instance.lastChecked = new Date();

      if (wasHealthy !== instance.isHealthy) {
        this.logger.info(
          `${type} service instance ${instance.url} health changed: ${instance.isHealthy ? 'healthy' : 'unhealthy'}`,
        );
      }
    } catch (error: any) {
      const wasHealthy = instance.isHealthy;
      instance.isHealthy = false;
      instance.lastChecked = new Date();

      if (wasHealthy) {
        this.logger.warn(
          `${type} service instance ${instance.url} became unhealthy: ${error.message}`,
        );
      }
    }
  }

  /**
   * Get connection pool statistics including Redis assignments
   */
  private async getConnectionPoolStats(): Promise<any> {
    const redis = await this.queue.client;

    // Get all current assignments from Redis
    const simpleAssignments = await redis.keys(
      `${this.assignmentKey}:simple:*`,
    );
    const hierarchicalAssignments = await redis.keys(
      `${this.assignmentKey}:hierarchical:*`,
    );

    const simpleStats = this.simpleInstances.map((instance) => {
      const assignmentKey = `${this.assignmentKey}:simple:${instance.url}`;
      const isAssigned = simpleAssignments.includes(assignmentKey);
      return {
        url: instance.url,
        isHealthy: instance.isHealthy,
        activeConnections: instance.activeConnections,
        lastChecked: instance.lastChecked,
        isAssigned,
        isAssignedToMe: this.assignedServers.simple?.url === instance.url,
      };
    });

    const hierarchicalStats = this.hierarchicalInstances.map((instance) => {
      const assignmentKey = `${this.assignmentKey}:hierarchical:${instance.url}`;
      const isAssigned = hierarchicalAssignments.includes(assignmentKey);
      return {
        url: instance.url,
        isHealthy: instance.isHealthy,
        activeConnections: instance.activeConnections,
        lastChecked: instance.lastChecked,
        isAssigned,
        isAssignedToMe: this.assignedServers.hierarchical?.url === instance.url,
      };
    });

    return {
      serviceId: this.serviceId,
      assignedServers: {
        simple: this.assignedServers.simple?.url || null,
        hierarchical: this.assignedServers.hierarchical?.url || null,
      },
      simple: simpleStats,
      hierarchical: hierarchicalStats,
      totalHealthySimple: this.simpleInstances.filter((i) => i.isHealthy)
        .length,
      totalHealthyHierarchical: this.hierarchicalInstances.filter(
        (i) => i.isHealthy,
      ).length,
      totalAssignedSimple: simpleAssignments.length,
      totalAssignedHierarchical: hierarchicalAssignments.length,
    };
  }

  /**
   * Cleanup resources on service destruction
   */
  async onModuleDestroy(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Release assigned servers
    if (this.assignedServers.simple) {
      await this.releaseServer(this.assignedServers.simple.url, 'simple');
    }
    if (this.assignedServers.hierarchical) {
      await this.releaseServer(
        this.assignedServers.hierarchical.url,
        'hierarchical',
      );
    }

    this.logger.info('AI Integration Service destroyed');
  }

  /**
   * Check AI service health status
   *
   * @returns Promise<boolean> - True if any service instance is healthy, false otherwise
   */
  private async checkHealth(): Promise<boolean> {
    const healthySimple = this.simpleInstances.some(
      (instance) => instance.isHealthy,
    );
    const healthyHierarchical = this.hierarchicalInstances.some(
      (instance) => instance.isHealthy,
    );
    return healthySimple && healthyHierarchical;
  }
}
