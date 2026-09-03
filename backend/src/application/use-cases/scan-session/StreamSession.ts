import { NotFoundException } from '@nestjs/common';
import {
  catchError,
  distinctUntilChanged,
  EMPTY,
  filter,
  interval,
  map,
  merge,
  Observable,
  startWith,
  switchMap,
  takeWhile,
} from 'rxjs';
import { SessionId } from 'src/kernel/ids';
import { Session } from 'src/kernel/types/model-types';
import { ScanErrorEvent, ScanProgressEvent, ScanStateEvent } from '../../ports/dtos/ScanProgress.types';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IScanProgressSubscriber } from '../../ports/infrastructure/IScanProgressSubscriber';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';
import { estimateCompletion } from './estimate-completion';

// How often to re-read the session row from Postgres and push a fresh 'state' event. This is
// the primary carrier of progress correctness -- it works with zero Redis (see
// scan_progress_publisher removal / DISABLE_REDIS on Hugging Face). Redis-sourced events
// (batch.complete, track.complete, scan.complete) still arrive on top of this when available,
// as a lower-latency nudge, but nothing depends on them being present.
const STATE_POLL_INTERVAL_MS = 2000;

/** Builds the `state` event payload from a ScanSession DB row -- shared by the initial SSE
 * frame and every subsequent poll tick, so they are always identical in shape. */
export const toStateEvent = (session: Session): ScanStateEvent => {
  const eta = estimateCompletion({
    startedAt: session.startedAt,
    completedTracks: session.completedTracks,
    failedTracks: session.failedTracks,
    totalTracks: session.totalTracks,
  });

  return {
    type: 'state',
    sessionId: session.id,
    timestamp: new Date().toISOString(),
    libraryId: session.libraryId,
    data: {
      status: session.status,
      totalBatches: session.totalBatches,
      completedBatches: session.completedBatches,
      totalTracks: session.totalTracks,
      completedTracks: session.completedTracks,
      failedTracks: session.failedTracks,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      etaSeconds: eta.etaSeconds,
      tracksPerSecond: eta.tracksPerSecond,
      confidence: eta.confidence,
      elapsedSeconds: eta.elapsedSeconds,
    },
    // overallProgress leaves the backend as a 0-100 percentage; the DB stores basis points.
    overallProgress: session.overallProgress / 100,
  };
};

export class StreamSessionUseCase {
  constructor(
    private readonly scanSessionRepository: IScanSessionRepository,
    private readonly scanProgressSubscriber: IScanProgressSubscriber,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('StreamSessionUseCase');
  }

  async execute(
    sessionId: SessionId,
  ): Promise<Observable<{ data: ScanProgressEvent | ScanErrorEvent }>> {
    try {
      // Verify session exists
      const session = await this.scanSessionRepository.getSession(sessionId);
      if (!session) {
        this.logger.debug(`Session ${sessionId} not found`);
        return EMPTY;
      }

      // Subscribe to Redis events (non-blocking, best-effort -- see the module comment).
      // If Redis is unavailable this throws; the DB poll below still carries correct progress
      // on its own, so a failed subscribe here should not prevent the stream from starting.
      try {
        this.logger.info(`Subscribing to events for session ${sessionId}`);
        await this.scanProgressSubscriber.subscribeToSession(sessionId);
        this.logger.info(`Subscribed to events for session ${sessionId}`);
      } catch (error) {
        this.logger.warn(
          `Could not subscribe to Redis events for session ${sessionId}; continuing with DB-polled state only:`,
          error,
        );
      }

      // Authoritative state, sourced from Postgres: one frame immediately, then a fresh one
      // every STATE_POLL_INTERVAL_MS for as long as the scan is still running. This is what
      // makes progress correct with no Redis at all -- ScanSession's counters are updated
      // atomically by the batch/track processing use-cases regardless of pub/sub availability.
      const statePoll$: Observable<{ data: ScanStateEvent }> = interval(
        STATE_POLL_INTERVAL_MS,
      ).pipe(
        switchMap(() => this.scanSessionRepository.getSession(sessionId)),
        filter((s): s is Session => !!s),
        startWith(session),
        distinctUntilChanged(
          (a, b) =>
            a.completedTracks === b.completedTracks &&
            a.completedBatches === b.completedBatches &&
            a.failedTracks === b.failedTracks &&
            a.status === b.status,
        ),
        map((s) => ({ data: toStateEvent(s) })),
        takeWhile((event) => event.data.data.status === 'SCANNING', true),
        catchError((error) => {
          this.logger.error(`Error polling DB state for session ${sessionId}:`, error);
          return EMPTY;
        }),
      );

      // Create event stream
      this.logger.info(`Creating event stream for session ${sessionId}`);
      const eventsStream: Observable<{
        data: ScanProgressEvent | ScanErrorEvent;
      }> = this.scanProgressSubscriber.getEventStream(sessionId).pipe(
        map((event) => ({ data: event })),
        catchError((error) => {
          this.logger.error(`Error in event stream for session ${sessionId}:`, error);
          const errorEvent: ScanErrorEvent = {
            type: 'error',
            sessionId,
            timestamp: new Date().toISOString(),
            severity: 'error',
            source: 'backend',
            error: {
              code: 'STREAM_ERROR',
              message: error.message,
            },
          };
          return new Observable<{ data: ScanErrorEvent }>((subscriber) => {
            subscriber.next({ data: errorEvent });
            subscriber.complete();
          });
        }),
      );

      // Create error stream
      this.logger.info(`Creating error stream for session ${sessionId}`);
      const errorsStream: Observable<{ data: ScanErrorEvent }> = this.scanProgressSubscriber
        .getErrorStream(sessionId)
        .pipe(
          map((error) => ({ data: error })),
          catchError((error) => {
            this.logger.error(`Error in error stream for session ${sessionId}:`, error);
            return EMPTY;
          }),
        );

      // Merge all streams: DB-polled state is authoritative and self-sufficient; Redis events
      // (when available) arrive on top as a faster nudge. NestJS handles connection
      // management, so keep-alive is not needed.
      this.logger.info(`Merging streams for session ${sessionId}`);
      const mergedStream: Observable<{
        data: ScanProgressEvent | ScanErrorEvent;
      }> = merge(statePoll$, eventsStream, errorsStream) as Observable<{
        data: ScanProgressEvent | ScanErrorEvent;
      }>;

      return mergedStream.pipe(
        catchError((error): Observable<{ data: ScanErrorEvent }> => {
          this.logger.error(`Fatal error in SSE stream for session ${sessionId}:`, error);
          const fatalError: ScanErrorEvent = {
            type: 'error',
            sessionId,
            timestamp: new Date().toISOString(),
            severity: 'error',
            source: 'backend',
            error: {
              code: 'FATAL_STREAM_ERROR',
              message: error.message,
            },
          };
          return new Observable<{ data: ScanErrorEvent }>((subscriber) => {
            subscriber.next({ data: fatalError });
            subscriber.complete();
          });
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to create SSE stream for session ${sessionId}:`, {
        errorMessage: error.message,
        error,
      });
      console.error(error.stack);
      const errorEvent: ScanErrorEvent = {
        type: 'error',
        sessionId,
        timestamp: new Date().toISOString(),
        severity: 'error',
        source: 'backend',
        error: {
          code: error instanceof NotFoundException ? 'SESSION_NOT_FOUND' : 'STREAM_INIT_ERROR',
          message: error.message,
        },
      };
      return new Observable((subscriber) => {
        subscriber.next({ data: errorEvent });
        subscriber.complete();
      });
    }
  }
}
