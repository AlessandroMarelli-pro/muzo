import { catchError, EMPTY, map, merge, Observable } from 'rxjs';
import { HqAudioBatchProgressEvent } from 'src/application/ports/dtos/HqAudioBatchProgress.types';
import { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { IHqAudioBatchProgressSubscriber } from 'src/application/ports/infrastructure/IHqAudioBatchProgressSubscriber';
import { HqAudioBatchId } from 'src/kernel/ids';

export class StreamHqAudioBatchProgressUseCase {
  constructor(
    private readonly hqAudioBatchProgressSubscriber: IHqAudioBatchProgressSubscriber,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('StreamHqAudioBatchProgressUseCase');
  }

  async execute(batchId: HqAudioBatchId): Promise<Observable<{ data: HqAudioBatchProgressEvent }>> {
    try {
      const currentState = await this.hqAudioBatchProgressSubscriber.getCurrentState(batchId);
      if (!currentState) {
        this.logger.debug(`Batch ${batchId} not found`);
        return EMPTY;
      }

      await this.hqAudioBatchProgressSubscriber.subscribeToBatch(batchId);

      const initialEvent: HqAudioBatchProgressEvent = {
        type: 'batch.state',
        batchId,
        timestamp: new Date().toISOString(),
        state: currentState,
      };

      const initialStateStream: Observable<{ data: HqAudioBatchProgressEvent }> = new Observable(
        (subscriber) => {
          subscriber.next({ data: initialEvent });
          subscriber.complete();
        },
      );

      const eventsStream: Observable<{ data: HqAudioBatchProgressEvent }> =
        this.hqAudioBatchProgressSubscriber.getEventStream(batchId).pipe(
          map((event) => ({ data: event })),
          catchError((error) => {
            this.logger.error(`Error in event stream for batch ${batchId}:`, error);
            return EMPTY;
          }),
        );

      return merge(initialStateStream, eventsStream);
    } catch (error) {
      this.logger.error(`Failed to create SSE stream for batch ${batchId}:`, {
        errorMessage: error.message,
        error,
      });
      return EMPTY;
    }
  }
}
