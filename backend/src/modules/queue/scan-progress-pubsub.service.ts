import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Observable, Subject } from 'rxjs';
import { QueueConfig } from '../../config';
import {
  ScanErrorEvent,
  ScanProgressEvent,
} from './scan-progress.types';

@Injectable()
export class ScanProgressPubSubService implements OnModuleDestroy {
  private readonly logger = new Logger(ScanProgressPubSubService.name);
  private readonly subscribers = new Map<string, Subject<ScanProgressEvent>>();
  private readonly errorSubscribers = new Map<string, Subject<ScanErrorEvent>>();
  private readonly redisSubscribers = new Map<string, {
    events: Redis;
    errors: Redis;
  }>();
  private readonly channelPrefix: string;
  private redisPublisher: Redis;
  private redisState: Redis;

  constructor(private readonly configService: ConfigService) {
    const queueConfig = this.configService.get<QueueConfig>('queue');
    this.channelPrefix =
      this.configService.get<string>('REDIS_SCAN_CHANNEL_PREFIX') ||
      'scan:session';

    // Create Redis clients for publishing and state management
    this.redisPublisher = new Redis({
      host: queueConfig.redis.host,
      port: queueConfig.redis.port,
      password: queueConfig.redis.password,
      db: queueConfig.redis.db,
    });

    this.redisState = new Redis({
      host: queueConfig.redis.host,
      port: queueConfig.redis.port,
      password: queueConfig.redis.password,
      db: queueConfig.redis.db,
    });
  }

  /**
   * Subscribe to events for a session
   */
  async subscribeToSession(sessionId: string): Promise<void> {
    if (this.subscribers.has(sessionId)) {
      this.logger.log(`Already subscribed to session ${sessionId}`);
      // Already subscribed
      return;
    }

    try {
      const queueConfig = this.configService.get<QueueConfig>('queue');
      const eventsChannel = `${this.channelPrefix}:${sessionId}:events`;
      const errorsChannel = `${this.channelPrefix}:${sessionId}:errors`;

      // Create subjects for this session
      const eventsSubject = new Subject<ScanProgressEvent>();
      const errorsSubject = new Subject<ScanErrorEvent>();
      this.subscribers.set(sessionId, eventsSubject);
      this.errorSubscribers.set(sessionId, errorsSubject);

      // Subscribe to events channel
      const eventsSubscriber = new Redis({
        host: queueConfig.redis.host,
        port: queueConfig.redis.port,
        password: queueConfig.redis.password,
        db: queueConfig.redis.db,
      });

      eventsSubscriber.subscribe(eventsChannel);
      eventsSubscriber.on('message', (channel, message) => {
        if (channel === eventsChannel) {
          try {
            const event: ScanProgressEvent = JSON.parse(message);
            eventsSubject.next(event);
          } catch (error) {
            this.logger.error(
              `Failed to parse event for session ${sessionId}:`,
              error,
            );
          }
        }
      });

      // Subscribe to errors channel
      const errorsSubscriber = new Redis({
        host: queueConfig.redis.host,
        port: queueConfig.redis.port,
        password: queueConfig.redis.password,
        db: queueConfig.redis.db,
      });

      errorsSubscriber.subscribe(errorsChannel);
      errorsSubscriber.on('message', (channel, message) => {
        if (channel === errorsChannel) {
          try {
            const error: ScanErrorEvent = JSON.parse(message);
            errorsSubject.next(error);
          } catch (error) {
            this.logger.error(
              `Failed to parse error for session ${sessionId}:`,
              error,
            );
          }
        }
      });

      // Store subscribers for cleanup
      this.redisSubscribers.set(sessionId, {
        events: eventsSubscriber,
        errors: errorsSubscriber,
      });

      this.logger.log(`Subscribed to scan progress for session: ${sessionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to session ${sessionId}:`,
        error,
      );
      // Clean up on error
      this.subscribers.delete(sessionId);
      this.errorSubscribers.delete(sessionId);
      throw error;
    }
  }

  /**
   * Unsubscribe from a session
   */
  async unsubscribeFromSession(sessionId: string): Promise<void> {
    try {
      const subscribers = this.redisSubscribers.get(sessionId);
      if (subscribers) {
        await subscribers.events.unsubscribe();
        await subscribers.errors.unsubscribe();
        subscribers.events.disconnect();
        subscribers.errors.disconnect();
        this.redisSubscribers.delete(sessionId);
      }

      const eventsSubject = this.subscribers.get(sessionId);
      if (eventsSubject) {
        eventsSubject.complete();
        this.subscribers.delete(sessionId);
      }

      const errorsSubject = this.errorSubscribers.get(sessionId);
      if (errorsSubject) {
        errorsSubject.complete();
        this.errorSubscribers.delete(sessionId);
      }

      this.logger.log(`Unsubscribed from scan progress for session: ${sessionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to unsubscribe from session ${sessionId}:`,
        error,
      );
    }
  }

  /**
   * Publish an event to Redis
   */
  async publishEvent(
    sessionId: string,
    event: ScanProgressEvent,
  ): Promise<void> {
    try {
      if ((event as any)?.overallProgress) {
        console.log('OVERALL PROGRESS', (event as any).overallProgress);
      }
      const channel = `${this.channelPrefix}:${sessionId}:events`;
      // Use setImmediate to avoid blocking the event loop
      this.logger.debug(`Publishing ${event.type} event to channel ${channel}`);

      const eventJson = JSON.stringify(event);
      await this.redisPublisher.publish(channel, eventJson);
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      this.logger.error(
        `Failed to publish event for session ${sessionId}:`,
        error,
      );
      // Don't throw - event publishing shouldn't break the scan
    }
  }

  /**
   * Publish an error to Redis
   */
  async publishError(sessionId: string, error: ScanErrorEvent): Promise<void> {
    try {
      const channel = `${this.channelPrefix}:${sessionId}:errors`;
      // Use setImmediate to avoid blocking the event loop
      this.logger.warn(
        `Publishing error to channel ${channel}: ${error.error?.code || 'UNKNOWN'} - ${error.error?.message || 'No message'}`,
      );
      const errorJson = JSON.stringify(error);
      await this.redisPublisher.publish(channel, errorJson);
    } catch (error) {
      this.logger.error(
        `Failed to publish error for session ${sessionId}:`,
        error,
      );
      // Don't throw - error publishing shouldn't break the scan
    }
  }

  /**
   * Get event stream for a session
   */
  getEventStream(sessionId: string): Observable<ScanProgressEvent> {
    const subject = this.subscribers.get(sessionId);
    // Use debug level to avoid excessive logging
    if (!subject) {
      this.logger.debug(`Creating new event stream for session ${sessionId}`);
      // Create a new subject if not exists (will be subscribed when needed)
      const newSubject = new Subject<ScanProgressEvent>();
      this.subscribers.set(sessionId, newSubject);
      return newSubject.asObservable();
    }
    return subject.asObservable();
  }

  /**
   * Get error stream for a session
   */
  getErrorStream(sessionId: string): Observable<ScanErrorEvent> {
    const subject = this.errorSubscribers.get(sessionId);
    if (!subject) {
      // Create a new subject if not exists
      const newSubject = new Subject<ScanErrorEvent>();
      this.errorSubscribers.set(sessionId, newSubject);
      return newSubject.asObservable();
    }
    return subject.asObservable();
  }

  /**
   * Get current state from Redis (if stored)
   */
  async getCurrentState(sessionId: string): Promise<any> {
    try {
      this.logger.debug(`Getting current state for session ${sessionId}`);
      const stateKey = `${this.channelPrefix}:${sessionId}:state`;
      const state = await this.redisState.get(stateKey);
      if (!state) {
        return null;
      }
      // State should be small, so synchronous parse is acceptable
      return JSON.parse(state);
    } catch (error) {
      this.logger.error(
        `Failed to get current state for session ${sessionId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Store current state in Redis
   */
  async setCurrentState(sessionId: string, state: any): Promise<void> {
    try {
      const stateKey = `${this.channelPrefix}:${sessionId}:state`;
      const ttl = this.configService.get<number>('SCAN_SESSION_TTL') || 86400; // 24h default
      await this.redisState.setex(stateKey, ttl, JSON.stringify(state));
    } catch (error) {
      this.logger.error(
        `Failed to set current state for session ${sessionId}:`,
        error,
      );
      // Don't throw - state storage shouldn't break the scan
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    // Unsubscribe from all sessions
    const sessionIds = Array.from(this.redisSubscribers.keys());
    for (const sessionId of sessionIds) {
      await this.unsubscribeFromSession(sessionId);
    }

    // Disconnect Redis clients
    this.redisPublisher.disconnect();
    this.redisState.disconnect();
  }
}
