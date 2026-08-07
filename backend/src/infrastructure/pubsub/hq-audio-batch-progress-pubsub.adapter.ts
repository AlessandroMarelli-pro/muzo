import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Observable, Subject } from 'rxjs';
import {
  HqAudioBatchProgressEvent,
  HqAudioBatchState,
} from 'src/application/ports/dtos/HqAudioBatchProgress.types';
import { IHqAudioBatchProgressPublisher } from 'src/application/ports/infrastructure/IHqAudioBatchProgressPublisher';
import { IHqAudioBatchProgressSubscriber } from 'src/application/ports/infrastructure/IHqAudioBatchProgressSubscriber';
import { QueueConfig } from 'src/config';
import { HqAudioBatchId } from 'src/kernel/ids';

const STATE_TTL_SECONDS = 60 * 60;

@Injectable()
export class HqAudioBatchProgressPubSubAdapter
  implements IHqAudioBatchProgressPublisher, IHqAudioBatchProgressSubscriber, OnModuleDestroy
{
  private readonly logger = new Logger(HqAudioBatchProgressPubSubAdapter.name);
  private readonly subscribers = new Map<string, Subject<HqAudioBatchProgressEvent>>();
  private readonly redisSubscribers = new Map<string, Redis>();
  private readonly channelPrefix: string;
  private redisPublisher: Redis;
  private redisState: Redis;

  constructor(private readonly configService: ConfigService) {
    const queueConfig = this.configService.get<QueueConfig>('queue')!;
    this.channelPrefix =
      this.configService.get<string>('REDIS_HQ_AUDIO_BATCH_CHANNEL_PREFIX') || 'hq-audio-batch';

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

  async subscribeToBatch(batchId: string): Promise<void> {
    if (this.subscribers.has(batchId)) {
      return;
    }

    try {
      const queueConfig = this.configService.get<QueueConfig>('queue');
      const eventsChannel = `${this.channelPrefix}:${batchId}:events`;

      const eventsSubject = new Subject<HqAudioBatchProgressEvent>();
      this.subscribers.set(batchId, eventsSubject);

      const eventsSubscriber = new Redis({
        host: queueConfig?.redis.host,
        port: queueConfig?.redis.port,
        password: queueConfig?.redis.password,
        db: queueConfig?.redis.db,
      });

      eventsSubscriber.subscribe(eventsChannel);
      eventsSubscriber.on('message', (channel, message) => {
        if (channel === eventsChannel) {
          try {
            const event: HqAudioBatchProgressEvent = JSON.parse(message);
            eventsSubject.next(event);
          } catch (error) {
            this.logger.error(`Failed to parse event for batch ${batchId}:`, error);
          }
        }
      });

      this.redisSubscribers.set(batchId, eventsSubscriber);
      this.logger.log(`Subscribed to HQ audio batch progress for batch: ${batchId}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to batch ${batchId}:`, error);
      this.subscribers.delete(batchId);
      throw error;
    }
  }

  async unsubscribeFromBatch(batchId: string): Promise<void> {
    try {
      const subscriber = this.redisSubscribers.get(batchId);
      if (subscriber) {
        await subscriber.unsubscribe();
        subscriber.disconnect();
        this.redisSubscribers.delete(batchId);
      }

      const eventsSubject = this.subscribers.get(batchId);
      if (eventsSubject) {
        eventsSubject.complete();
        this.subscribers.delete(batchId);
      }

      this.logger.log(`Unsubscribed from HQ audio batch progress for batch: ${batchId}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from batch ${batchId}:`, error);
    }
  }

  async publishEvent(batchId: HqAudioBatchId, event: HqAudioBatchProgressEvent): Promise<void> {
    try {
      const channel = `${this.channelPrefix}:${batchId}:events`;
      this.logger.debug(`Publishing ${event.type} event to channel ${channel}`);
      await this.redisPublisher.publish(channel, JSON.stringify(event));
    } catch (error) {
      this.logger.error(`Failed to publish event for batch ${batchId}:`, error);
    }
  }

  async setState(batchId: HqAudioBatchId, state: HqAudioBatchState): Promise<void> {
    try {
      const stateKey = `${this.channelPrefix}:${batchId}:state`;
      await this.redisState.set(stateKey, JSON.stringify(state), 'EX', STATE_TTL_SECONDS);
    } catch (error) {
      this.logger.error(`Failed to set state for batch ${batchId}:`, error);
    }
  }

  getEventStream(batchId: string): Observable<HqAudioBatchProgressEvent> {
    const subject = this.subscribers.get(batchId);
    if (!subject) {
      this.logger.debug(`Creating new event stream for batch ${batchId}`);
      const newSubject = new Subject<HqAudioBatchProgressEvent>();
      this.subscribers.set(batchId, newSubject);
      return newSubject.asObservable();
    }
    return subject.asObservable();
  }

  async getCurrentState(batchId: string): Promise<HqAudioBatchState | null> {
    try {
      const stateKey = `${this.channelPrefix}:${batchId}:state`;
      const state = await this.redisState.get(stateKey);
      if (!state) {
        return null;
      }
      return JSON.parse(state);
    } catch (error) {
      this.logger.error(`Failed to get current state for batch ${batchId}:`, error);
      return null;
    }
  }

  async onModuleDestroy() {
    const batchIds = Array.from(this.redisSubscribers.keys());
    for (const batchId of batchIds) {
      await this.unsubscribeFromBatch(batchId);
    }

    this.redisPublisher.disconnect();
    this.redisState.disconnect();
  }
}
