import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Result, Callback } from 'ioredis';
import { Observable, Subject } from 'rxjs';
import {
  HqAudioBatchProgressEvent,
  HqAudioBatchState,
  HqAudioBatchTrackState,
  HqAudioTrackStatus,
} from 'src/application/ports/dtos/HqAudioBatchProgress.types';
import { IHqAudioBatchProgressPublisher } from 'src/application/ports/infrastructure/IHqAudioBatchProgressPublisher';
import { IHqAudioBatchProgressSubscriber } from 'src/application/ports/infrastructure/IHqAudioBatchProgressSubscriber';
import { QueueConfig } from 'src/config';
import { HqAudioBatchId } from 'src/kernel/ids';

const STATE_TTL_SECONDS = 60 * 60;

const COUNTER_FIELDS = [
  'queued',
  'downloading',
  'succeeded',
  'failed',
  'skipped',
  'cancelled',
] as const;

// Atomically transitions one track's status and adjusts the meta hash's aggregate counters, so
// concurrently-settling tracks (up to 5 at once via sockseek's --concurrent-jobs) never lose
// each other's updates the way a plain GET-modify-SET on a single JSON blob would.
// KEYS[1] = tracks hash, KEYS[2] = meta hash
// ARGV[1] = trackId, ARGV[2] = newStatus, ARGV[3] = errorMessage ('' if none), ARGV[4] = nowISO
const UPDATE_TRACK_STATUS_SCRIPT = `
local trackJson = redis.call('HGET', KEYS[1], ARGV[1])
if not trackJson then
  return false
end
local track = cjson.decode(trackJson)
local terminal = { succeeded = true, failed = true, skipped = true, cancelled = true }
if terminal[track.status] then
  return false
end

local oldStatus = track.status
track.status = ARGV[2]
if ARGV[3] ~= '' then
  track.errorMessage = ARGV[3]
end
redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(track))

redis.call('HINCRBY', KEYS[2], oldStatus, -1)
redis.call('HINCRBY', KEYS[2], ARGV[2], 1)
redis.call('HSET', KEYS[2], 'updatedAt', ARGV[4])

local queued = tonumber(redis.call('HGET', KEYS[2], 'queued'))
local downloading = tonumber(redis.call('HGET', KEYS[2], 'downloading'))
local currentStatus = redis.call('HGET', KEYS[2], 'status')
if currentStatus ~= 'cancelled' and queued == 0 and downloading == 0 then
  redis.call('HSET', KEYS[2], 'status', 'completed')
end

return true
`;

// Atomically marks every queued/downloading track as cancelled and stops the batch.
// KEYS[1] = tracks hash, KEYS[2] = meta hash
// ARGV[1] = nowISO
const CANCEL_BATCH_SCRIPT = `
local currentStatus = redis.call('HGET', KEYS[2], 'status')
if currentStatus ~= 'running' then
  return false
end

local cancelledCount = 0
local cursor = '0'
repeat
  local result = redis.call('HSCAN', KEYS[1], cursor)
  cursor = result[1]
  local entries = result[2]
  for i = 1, #entries, 2 do
    local trackId = entries[i]
    local trackJson = entries[i + 1]
    local track = cjson.decode(trackJson)
    if track.status == 'queued' or track.status == 'downloading' then
      track.status = 'cancelled'
      redis.call('HSET', KEYS[1], trackId, cjson.encode(track))
      cancelledCount = cancelledCount + 1
    end
  end
until cursor == '0'

redis.call('HSET', KEYS[2], 'queued', '0')
redis.call('HSET', KEYS[2], 'downloading', '0')
local prevCancelled = tonumber(redis.call('HGET', KEYS[2], 'cancelled')) or 0
redis.call('HSET', KEYS[2], 'cancelled', tostring(prevCancelled + cancelledCount))
redis.call('HSET', KEYS[2], 'status', 'cancelled')
redis.call('HSET', KEYS[2], 'updatedAt', ARGV[1])

return true
`;

declare module 'ioredis' {
  interface RedisCommander<Context> {
    hqUpdateTrackStatus(
      tracksKey: string,
      metaKey: string,
      trackId: string,
      status: string,
      errorMessage: string,
      now: string,
      callback?: Callback<number>,
    ): Result<number, Context>;
    hqCancelBatch(
      tracksKey: string,
      metaKey: string,
      now: string,
      callback?: Callback<number>,
    ): Result<number, Context>;
  }
}

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
    this.redisPublisher.on('error', (error) => {
      this.logger.error('Redis publisher connection error:', error);
    });

    this.redisState = new Redis({
      host: queueConfig.redis.host,
      port: queueConfig.redis.port,
      password: queueConfig.redis.password,
      db: queueConfig.redis.db,
    });
    this.redisState.on('error', (error) => {
      this.logger.error('Redis state connection error:', error);
    });

    this.redisState.defineCommand('hqUpdateTrackStatus', {
      numberOfKeys: 2,
      lua: UPDATE_TRACK_STATUS_SCRIPT,
    });
    this.redisState.defineCommand('hqCancelBatch', {
      numberOfKeys: 2,
      lua: CANCEL_BATCH_SCRIPT,
    });
  }

  private tracksKey(batchId: string): string {
    return `${this.channelPrefix}:${batchId}:tracks`;
  }

  private metaKey(batchId: string): string {
    return `${this.channelPrefix}:${batchId}:meta`;
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
      eventsSubscriber.on('error', (error) => {
        this.logger.error(`Redis subscriber connection error for batch ${batchId}:`, error);
      });

      // Registered before subscribing (and set in redisSubscribers below) so a fast-following
      // unsubscribe can never race a still-connecting client into disconnect()ing mid-command.
      this.redisSubscribers.set(batchId, eventsSubscriber);

      await eventsSubscriber.subscribe(eventsChannel);
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
      const tracksKey = this.tracksKey(batchId);
      const metaKey = this.metaKey(batchId);

      const pipeline = this.redisState.multi();
      pipeline.del(tracksKey);
      pipeline.del(metaKey);

      const trackFields: string[] = [];
      for (const track of state.tracks) {
        trackFields.push(track.trackId, JSON.stringify(track));
      }
      if (trackFields.length > 0) {
        pipeline.hset(tracksKey, ...trackFields);
      }

      const metaFields: Record<string, string> = {
        batchId: state.batchId,
        playlistId: state.playlistId,
        total: String(state.total),
        status: state.status,
        startedAt: state.startedAt,
        updatedAt: state.updatedAt,
      };
      for (const field of COUNTER_FIELDS) {
        metaFields[field] = String(state[field]);
      }
      pipeline.hset(metaKey, metaFields);

      pipeline.expire(tracksKey, STATE_TTL_SECONDS);
      pipeline.expire(metaKey, STATE_TTL_SECONDS);

      await pipeline.exec();
    } catch (error) {
      this.logger.error(`Failed to set state for batch ${batchId}:`, error);
    }
  }

  async updateTrackStatus(
    batchId: HqAudioBatchId,
    trackId: string,
    status: HqAudioTrackStatus,
    errorMessage?: string,
  ): Promise<HqAudioBatchState | null> {
    try {
      const applied = await this.redisState.hqUpdateTrackStatus(
        this.tracksKey(batchId),
        this.metaKey(batchId),
        trackId,
        status,
        errorMessage ?? '',
        new Date().toISOString(),
      );
      if (!applied) {
        return null;
      }
      return this.getCurrentState(batchId);
    } catch (error) {
      this.logger.error(`Failed to update track status for batch ${batchId}, track ${trackId}:`, error);
      return null;
    }
  }

  async cancelBatch(batchId: HqAudioBatchId): Promise<HqAudioBatchState | null> {
    try {
      const applied = await this.redisState.hqCancelBatch(
        this.tracksKey(batchId),
        this.metaKey(batchId),
        new Date().toISOString(),
      );
      if (!applied) {
        return null;
      }
      return this.getCurrentState(batchId);
    } catch (error) {
      this.logger.error(`Failed to cancel batch ${batchId}:`, error);
      return null;
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
      const tracksKey = this.tracksKey(batchId);
      const metaKey = this.metaKey(batchId);

      const pipeline = this.redisState.multi();
      pipeline.hgetall(metaKey);
      pipeline.hgetall(tracksKey);
      const results = await pipeline.exec();

      if (!results) {
        return null;
      }
      const [[metaError, meta], [tracksError, tracksRaw]] = results as [
        [Error | null, Record<string, string>],
        [Error | null, Record<string, string>],
      ];
      if (metaError || tracksError) {
        throw metaError ?? tracksError;
      }
      if (!meta || Object.keys(meta).length === 0) {
        return null;
      }

      const tracks: HqAudioBatchTrackState[] = Object.values(tracksRaw ?? {})
        .map((json) => JSON.parse(json) as HqAudioBatchTrackState)
        .sort((a, b) => a.position - b.position);

      const state: HqAudioBatchState = {
        batchId: meta.batchId,
        playlistId: meta.playlistId,
        total: Number(meta.total),
        queued: Number(meta.queued ?? 0),
        downloading: Number(meta.downloading ?? 0),
        succeeded: Number(meta.succeeded ?? 0),
        failed: Number(meta.failed ?? 0),
        skipped: Number(meta.skipped ?? 0),
        cancelled: Number(meta.cancelled ?? 0),
        status: meta.status as HqAudioBatchState['status'],
        startedAt: meta.startedAt,
        updatedAt: meta.updatedAt,
        tracks,
      };
      return state;
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
