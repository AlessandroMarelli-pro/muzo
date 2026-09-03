import { firstValueFrom } from 'rxjs';
import { take, toArray } from 'rxjs/operators';
import { HqAudioBatchProgressPubSubAdapter } from 'src/infrastructure/pubsub/hq-audio-batch-progress-pubsub.adapter';
import type { HqAudioBatchProgressEvent } from 'src/application/ports/dtos/HqAudioBatchProgress.types';
import type { HqAudioBatchId } from 'src/kernel/ids';

vi.mock('ioredis', () => {
  class FakeRedis {
    on = vi.fn();
    defineCommand = vi.fn();
    disconnect = vi.fn();
  }
  return { default: FakeRedis };
});

const config = {
  get: vi.fn((key: string) => {
    if (key === 'queue') {
      return { redis: { host: 'localhost', port: 6379, password: undefined, db: 0 } };
    }
    return undefined;
  }),
} as never;

const BATCH = 'batch-1' as HqAudioBatchId;

function evt(): HqAudioBatchProgressEvent {
  return { type: 'track.update', batchId: BATCH, track: { trackId: 't1' } } as never;
}

describe('HqAudioBatchProgressPubSubAdapter (in-process bus)', () => {
  it('publishEvent reaches getEventStream without Redis', async () => {
    const adapter = new HqAudioBatchProgressPubSubAdapter(config);
    await adapter.subscribeToBatch(BATCH);

    const received = firstValueFrom(adapter.getEventStream(BATCH).pipe(take(1)));
    await adapter.publishEvent(BATCH, evt());

    expect(await received).toEqual(evt());
  });

  it('drops the subject only when the last subscriber leaves', async () => {
    const adapter = new HqAudioBatchProgressPubSubAdapter(config);
    await adapter.subscribeToBatch(BATCH);
    await adapter.subscribeToBatch(BATCH);

    const collected = firstValueFrom(adapter.getEventStream(BATCH).pipe(toArray()));

    await adapter.unsubscribeFromBatch(BATCH);
    await adapter.publishEvent(BATCH, evt()); // one ref still open — delivered
    await adapter.unsubscribeFromBatch(BATCH); // last ref — completes the stream

    expect(await collected).toEqual([evt()]);
  });
});
