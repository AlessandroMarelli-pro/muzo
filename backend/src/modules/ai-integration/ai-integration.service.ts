import { InjectQueue } from '@nestjs/bullmq';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Queue } from 'bullmq';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from 'src/shared/services/prisma.service';
import { AiServiceConfig } from '../../config';
import { SimpleAudioAnalysisResponse } from './ai-service-simple.types';
import {
  AudioAnalysisResponse,
  AudioFingerprintResponse,
} from './ai-service.types';

interface ServiceInstance {
  backendPort: number;
  url: string;
  isHealthy: boolean;
  lastChecked: Date;
  activeConnections: number;
}

interface AssignedServers {
  simple: ServiceInstance | null;
  hierarchical: ServiceInstance | null;
}

interface ServerAssignment {
  url: string;
  assignedTo: string;
  assignedAt: string;
  lastHeartbeat: string;
  serviceId: string;
}

/**
 * AI Service Integration Service
 *
 * This service provides HTTP client functionality for communicating with the
 * Muzo AI Service for audio analysis, fingerprinting, and genre classification.
 * Supports multiple service instances with Redis-based connection pooling.
 */
@Injectable()
export class AiIntegrationService {
  private readonly logger = new Logger(AiIntegrationService.name);
  private readonly httpClient: any;
  private readonly aiServiceConfig: AiServiceConfig;
  private readonly simpleInstances: ServiceInstance[] = [];
  private readonly hierarchicalInstances: ServiceInstance[] = [];
  private readonly assignedServers: AssignedServers = {
    simple: null,
    hierarchical: null,
  };
  private readonly connectionPoolKey = 'ai-service:connection-pool';
  private readonly assignmentKey = 'ai-service:assignments';
  private readonly heartbeatKey = 'ai-service:heartbeat';
  private readonly serviceId =
    process.env.HOSTNAME || `muzo-backend-${Date.now()}`;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('library-scan') private readonly libraryScanQueue: Queue,
    private readonly prisma: PrismaService,
  ) {
    // Get AI service configuration from centralized config
    this.aiServiceConfig = this.configService.get<AiServiceConfig>('aiService');

    // Initialize service instances
    this.initializeServiceInstances();

    // Initialize HTTP client with optimized configuration
    this.httpClient = axios.create({
      timeout: this.aiServiceConfig.timeout,
      headers: {
        'User-Agent': 'Muzo-Backend/1.0.0',
        Accept: 'application/json',
      },
    });

    // Add request/response interceptors for logging and error handling
    this.setupInterceptors();

    // Assign servers at startup
    this.assignServersAtStartup();

    // Start health checking
    this.startHealthChecking();

    // Start heartbeat for assigned servers
    this.startHeartbeat();

    this.logger.log(
      `AI Integration Service initialized with ${this.simpleInstances.length} simple instances and ${this.hierarchicalInstances.length} hierarchical instances`,
    );
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
    this.logger.log(
      `Assigning servers at startup for service: ${this.serviceId}`,
    );

    // Check health of all instances first
    await this.checkAllInstancesHealth();

    // Try to assign simple server
    await this.tryAssignServer('simple');

    // Try to assign hierarchical server
    await this.tryAssignServer('hierarchical');

    this.logger.log(
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
        this.logger.log(
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
      this.logger.log(
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
      const redis = await this.libraryScanQueue.client;
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
      const redis = await this.libraryScanQueue.client;
      const lockKey = `${this.assignmentKey}:${type}:${url}`;
      await redis.del(lockKey);
      this.logger.log(`Released ${type} server: ${url}`);
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
      const redis = await this.libraryScanQueue.client;
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
      const redis = await this.libraryScanQueue.client;
      const now = new Date();

      // Check simple server assignment
      if (this.assignedServers.simple) {
        const lockKey = `${this.assignmentKey}:simple:${this.assignedServers.simple.url}`;
        const assignment = await redis.get(lockKey);

        if (!assignment) {
          // Assignment expired, try to reassign
          this.logger.log(
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
          this.logger.log(
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
      this.logger.log(
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
      this.logger.log(
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
        this.logger.log(
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
   * Get assigned server for a specific type
   */
  private getAssignedServer(type: 'simple' | 'hierarchical'): ServiceInstance {
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
   * Get connection pool statistics including Redis assignments
   */
  async getConnectionPoolStats(): Promise<any> {
    const redis = await this.libraryScanQueue.client;

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
   * Setup HTTP client interceptors for logging and error handling
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(
          `Making request to AI service: ${config.method?.toUpperCase()} ${config.url}`,
        );
        return config;
      },
      (error) => {
        this.logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      },
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(
          `AI service response: ${response.status} ${response.statusText}`,
        );
        return response;
      },
      (error) => {
        this.logger.error('AI service request failed:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });
        return Promise.reject(error);
      },
    );
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

    this.logger.log('AI Integration Service destroyed');
  }

  /**
   * Check AI service health status
   *
   * @returns Promise<boolean> - True if any service instance is healthy, false otherwise
   */
  async checkHealth(): Promise<boolean> {
    const healthySimple = this.simpleInstances.some(
      (instance) => instance.isHealthy,
    );
    const healthyHierarchical = this.hierarchicalInstances.some(
      (instance) => instance.isHealthy,
    );
    return healthySimple && healthyHierarchical;
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
   * Analyze audio file for comprehensive features, fingerprint, and genre
   *
   * @param audioFilePath - Path to the audio file to analyze
   * @returns Promise<AudioAnalysisResponse> - Analysis results including features, fingerprint, and genre
   */
  async analyzeAudio(
    audioFilePath: string,
    skipClassification: boolean = false,
    skipImageSearch: boolean = false,
  ): Promise<SimpleAudioAnalysisResponse> {
    try {
      // Validate file exists and is accessible
      if (!fs.existsSync(audioFilePath)) {
        throw new HttpException(
          `Audio file not found: ${audioFilePath}`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Validate file extension
      const fileExtension = path.extname(audioFilePath).toLowerCase();
      const supportedExtensions = [
        '.wav',
        '.mp3',
        '.flac',
        '.m4a',
        '.aac',
        '.ogg',
      ];
      if (!supportedExtensions.includes(fileExtension)) {
        throw new HttpException(
          `Unsupported audio format: ${fileExtension}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      const track = await this.prisma.musicTrack.findUnique({
        where: {
          filePath: audioFilePath,
        },
        select: {
          imageSearches: true,
        },
      });
      const hasImageSearch =
        track?.imageSearches?.length > 0 || skipImageSearch;
      this.logger.log(`Analyzing audio file: ${audioFilePath}`);

      // Get assigned servers
      const hierarchicalInstance = !skipClassification
        ? this.getAssignedServer('hierarchical')
        : null;
      const simpleInstance = this.getAssignedServer('simple');

      // Create form data for file upload
      const formData = new FormData();
      formData.append('audio_file', fs.createReadStream(audioFilePath));

      this.logger.log(`Analyzing audio file: ${audioFilePath}`);

      const classificationResponse = !skipClassification
        ? await this.httpClient.post(
            `${hierarchicalInstance.url}/api/v1/audio/analyze/classification`,
            formData,
            {
              headers: {
                ...formData.getHeaders(),
              },
            },
          )
        : { data: null };

      const formDataSimple = new FormData();
      formDataSimple.append('audio_file', fs.createReadStream(audioFilePath));
      if (hasImageSearch) {
        formDataSimple.append('has_image', 'true');
      }
      const simpleResponse = await this.httpClient.post(
        `${simpleInstance.url}/api/v1/audio/analyze/simple`,
        formDataSimple,
        {
          headers: {
            ...formData.getHeaders(),
          },
        },
      );

      this.logger.log(`Audio analysis completed for: ${audioFilePath}`);
      const fullResponse = {
        ...simpleResponse.data,
        hierarchical_classification: classificationResponse.data,
      } as SimpleAudioAnalysisResponse;
      this.logger.log('Full response:', JSON.stringify(fullResponse));
      return fullResponse;
    } catch (error) {
      this.logger.error(
        `Audio analysis failed for ${audioFilePath}:`,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Audio analysis failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Generate audio fingerprint for duplicate detection
   *
   * @param audioFilePath - Path to the audio file
   * @returns Promise<AudioFingerprintResponse> - Fingerprint data and metadata
   */
  async generateFingerprint(
    audioFilePath: string,
  ): Promise<AudioFingerprintResponse> {
    try {
      // Validate file exists
      if (!fs.existsSync(audioFilePath)) {
        throw new HttpException(
          `Audio file not found: ${audioFilePath}`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Get assigned simple server
      const simpleInstance = this.getAssignedServer('simple');

      // Create form data for file upload
      const formData = new FormData();
      formData.append('audio_file', fs.createReadStream(audioFilePath));

      this.logger.log(`Generating fingerprint for: ${audioFilePath}`);

      // Make request to AI service
      const response = await this.httpClient.post(
        `${simpleInstance.url}/api/v1/audio/fingerprint`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        },
      );

      this.logger.log(`Fingerprint generated for: ${audioFilePath}`);
      return response.data as AudioFingerprintResponse;
    } catch (error) {
      this.logger.error(
        `Fingerprint generation failed for ${audioFilePath}:`,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Fingerprint generation failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Classify audio genre with confidence scores
   *
   * @param audioFilePath - Path to the audio file
   * @returns Promise<GenreClassificationResponse> - Genre classification results with confidence scores
   */
  async classifyGenre(audioFilePath: string): Promise<any> {
    try {
      // Validate file exists
      if (!fs.existsSync(audioFilePath)) {
        throw new HttpException(
          `Audio file not found: ${audioFilePath}`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Get assigned hierarchical server
      const hierarchicalInstance = this.getAssignedServer('hierarchical');

      // Create form data for file upload
      const formData = new FormData();
      formData.append('audio_file', fs.createReadStream(audioFilePath));

      this.logger.log(`Classifying genre for: ${audioFilePath}`);

      // Make request to AI service
      const response = await this.httpClient.post(
        `${hierarchicalInstance.url}/api/v1/audio/genre`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        },
      );
      this.logger.log(`Genre classification completed for: ${audioFilePath}`);
      return response.data as any;
    } catch (error) {
      this.logger.error(
        `Genre classification failed for ${audioFilePath}:`,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Genre classification failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Classify audio subgenre with confidence scores
   *
   * @param audioFilePath - Path to the audio file
   * @returns Promise<SubgenreClassificationResponse> - Subgenre classification results with confidence scores
   */
  async classifySubgenre(audioFilePath: string): Promise<any> {
    try {
      // Validate file exists
      if (!fs.existsSync(audioFilePath)) {
        throw new HttpException(
          `Audio file not found: ${audioFilePath}`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Get assigned hierarchical server
      const hierarchicalInstance = this.getAssignedServer('hierarchical');

      // Create form data for file upload
      const formData = new FormData();
      formData.append('file', fs.createReadStream(audioFilePath));

      this.logger.log(`Classifying subgenre for: ${audioFilePath}`);

      // Make request to AI service
      const response = await this.httpClient.post(
        `${hierarchicalInstance.url}/api/v1/audio/subgenre`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        },
      );

      this.logger.log(
        `Subgenre classification completed for: ${audioFilePath}`,
      );
      return response.data as any;
    } catch (error) {
      this.logger.error(
        `Subgenre classification failed for ${audioFilePath}:`,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Subgenre classification failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Compare two audio fingerprints for similarity
   *
   * @param fingerprint1 - First fingerprint data
   * @param fingerprint2 - Second fingerprint data
   * @returns Promise<number> - Similarity score between 0 and 1
   */
  async compareFingerprints(
    fingerprint1: any,
    fingerprint2: any,
  ): Promise<number> {
    try {
      // This would typically be done by the AI service, but for now we'll implement
      // a simple comparison logic here

      // Check file hash match (exact duplicate)
      if (fingerprint1.file_hash === fingerprint2.file_hash) {
        return 1.0;
      }

      // Check audio hash match (content-based)
      if (fingerprint1.audio_hash === fingerprint2.audio_hash) {
        return 0.95;
      }

      // Compare spectral fingerprints
      const spectral1 = fingerprint1.spectral_fingerprint;
      const spectral2 = fingerprint2.spectral_fingerprint;

      if (!spectral1 || !spectral2) {
        return 0.0;
      }

      // Calculate similarity based on spectral features
      const similarities = [];
      const features = ['centroid_mean', 'rolloff_mean', 'bandwidth_mean'];

      for (const feature of features) {
        if (spectral1[feature] && spectral2[feature]) {
          const val1 = spectral1[feature];
          const val2 = spectral2[feature];
          if (val1 !== 0 && val2 !== 0) {
            const similarity = 1 - Math.abs(val1 - val2) / Math.max(val1, val2);
            similarities.push(Math.max(0, similarity));
          }
        }
      }

      return similarities.length > 0
        ? similarities.reduce((a, b) => a + b) / similarities.length
        : 0.0;
    } catch (error) {
      this.logger.error('Fingerprint comparison failed:', error.message);
      return 0.0;
    }
  }

  /**
   * Batch analyze multiple audio files
   *
   * @param audioFilePaths - Array of audio file paths
   * @returns Promise<AudioAnalysisResponse[]> - Array of analysis results
   */
  async batchAnalyzeAudio(
    audioFilePaths: string[],
  ): Promise<AudioAnalysisResponse[]> {
    try {
      this.logger.log(
        `Starting batch analysis of ${audioFilePaths.length} files`,
      );

      // Process files in parallel with concurrency limit
      const concurrencyLimit = this.aiServiceConfig.batchConcurrency;
      const results: any[] = [];
      const errors: string[] = [];

      // Process files in batches to avoid overwhelming the AI service
      for (let i = 0; i < audioFilePaths.length; i += concurrencyLimit) {
        const batch = audioFilePaths.slice(i, i + concurrencyLimit);

        const batchPromises = batch.map(async (filePath) => {
          try {
            const result = await this.analyzeAudio(filePath);
            return { success: true, data: result, filePath };
          } catch (error) {
            this.logger.error(
              `Batch analysis failed for ${filePath}:`,
              error.message,
            );
            return { success: false, error: error.message, filePath };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        // Separate successful results from errors
        batchResults.forEach((result) => {
          if (result.success) {
            results.push(result.data);
          } else {
            errors.push(`${result.filePath}: ${result.error}`);
          }
        });

        // Add delay between batches to prevent overwhelming the service
        if (i + concurrencyLimit < audioFilePaths.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      this.logger.log(
        `Batch analysis completed: ${results.length} successful, ${errors.length} failed`,
      );

      if (errors.length > 0) {
        this.logger.warn('Batch analysis errors:', errors);
      }

      return results;
    } catch (error) {
      this.logger.error('Batch analysis failed:', error.message);
      throw new HttpException(
        `Batch analysis failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Detect BPM (Beats Per Minute) for an audio file
   *
   * @param audioFilePath - Path to the audio file
   * @returns Promise<any> - BPM detection result
   */
  async detectBPM(audioFilePath: string): Promise<any> {
    try {
      this.logger.log(`Starting BPM detection for: ${audioFilePath}`);

      // Validate file exists
      if (!fs.existsSync(audioFilePath)) {
        throw new HttpException(
          `Audio file not found: ${audioFilePath}`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Get assigned simple service instance
      const serviceInstance = this.assignedServers.simple;
      if (!serviceInstance || !serviceInstance.isHealthy) {
        throw new HttpException(
          'No healthy AI service instances available for BPM detection',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // Prepare form data for file upload
      const formData = new FormData();
      formData.append('audio_file', fs.createReadStream(audioFilePath));

      const startTime = Date.now();

      // Make request to BPM detection endpoint
      const response = await this.httpClient.post(
        `${serviceInstance.url}/api/v1/audio/bpm/detect`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: this.aiServiceConfig.timeout,
        },
      );

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `BPM detection completed for ${path.basename(audioFilePath)} in ${processingTime}ms`,
      );

      return {
        ...response.data,
        processingTime,
        serviceInstance: serviceInstance.url,
      };
    } catch (error) {
      this.logger.error(
        `BPM detection failed for ${audioFilePath}:`,
        error.message,
      );

      if (error.response) {
        // AI service returned an error response
        const statusCode = error.response.status;
        const errorMessage = error.response.data?.message || error.message;

        throw new HttpException(
          `BPM detection failed: ${errorMessage}`,
          statusCode,
        );
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        // Connection issues
        throw new HttpException(
          'AI service unavailable for BPM detection',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      } else {
        // Other errors
        throw new HttpException(
          `BPM detection failed: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  /**
   * Get AI service configuration and capabilities
   *
   * @returns Promise<any> - Service configuration and capabilities
   */
  async getServiceInfo(): Promise<any> {
    try {
      const stats = await this.getConnectionPoolStats();
      return {
        configuration: {
          simpleUrls: this.aiServiceConfig.simpleUrls,
          hierarchicalUrls: this.aiServiceConfig.hierarchicalUrls,
          timeout: this.aiServiceConfig.timeout,
          batchConcurrency: this.aiServiceConfig.batchConcurrency,
          connectionPoolTtl: this.aiServiceConfig.connectionPoolTtl,
        },
        instances: stats,
        capabilities: {
          audioAnalysis: true,
          fingerprintGeneration: true,
          genreClassification: true,
          subgenreClassification: true,
          batchProcessing: true,
          connectionPooling: true,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get AI service info:', error.message);
      throw new HttpException(
        'AI service info unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
