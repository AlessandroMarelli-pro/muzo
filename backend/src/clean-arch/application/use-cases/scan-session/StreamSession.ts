import { NotFoundException } from '@nestjs/common';
import { catchError, EMPTY, map, merge, Observable } from 'rxjs';
import { SessionId } from 'src/clean-arch/kernel/ids';
import {
  ScanErrorEvent,
  ScanProgressEvent,
} from '../../ports/dtos/ScanProgress.types';
import { IScanProgressPublisher } from '../../ports/infrastructure/IScanProgressPublisher';
import { IScanProgressSubscriber } from '../../ports/infrastructure/IScanProgressSubscriber';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';

export class StreamSessionUseCase {
  constructor(
    private readonly scanSessionRepository: IScanSessionRepository,
    private readonly scanProgressSubscriber: IScanProgressSubscriber,
    private readonly scanProgressPublisher: IScanProgressPublisher,
  ) {}

  async execute(
    sessionId: SessionId,
  ): Promise<Observable<{ data: ScanProgressEvent | ScanErrorEvent }>> {
    try {
      // Verify session exists
      const session = await this.scanSessionRepository.getSession(sessionId);
      if (!session) {
        return EMPTY;
      }

      // Subscribe to events (non-blocking)
      await this.scanProgressSubscriber.subscribeToSession(sessionId);

      // Get initial state
      const currentState =
        await this.scanProgressSubscriber.getCurrentState(sessionId);
      const initialState: ScanProgressEvent = currentState
        ? {
            type: 'state',
            sessionId,
            timestamp: new Date().toISOString(),
            data: currentState,
            overallProgress: session.overallProgress,
          }
        : {
            type: 'state',
            sessionId,
            timestamp: new Date().toISOString(),
            data: {
              status: session.status,
              totalBatches: session.totalBatches,
              completedBatches: session.completedBatches,
              totalTracks: session.totalTracks,
              completedTracks: session.completedTracks,
              failedTracks: session.failedTracks,
              startedAt: session.startedAt,
              updatedAt: session.updatedAt,
            },
            overallProgress: session.overallProgress,
          };

      // Create event stream
      const eventsStream: Observable<{
        data: ScanProgressEvent | ScanErrorEvent;
      }> = this.scanProgressSubscriber.getEventStream(sessionId).pipe(
        map((event) => ({ data: event })),
        catchError((error) => {
          console.error(
            `Error in event stream for session ${sessionId}:`,
            error,
          );
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
      const errorsStream: Observable<{ data: ScanErrorEvent }> =
        this.scanProgressSubscriber.getErrorStream(sessionId).pipe(
          map((error) => ({ data: error })),
          catchError((error) => {
            console.error(
              `Error in error stream for session ${sessionId}:`,
              error,
            );
            return EMPTY;
          }),
        );

      // Merge all streams: start with initial state, then merge events and errors
      // NestJS handles connection management, so keep-alive is not needed
      const initialStateStream: Observable<{ data: ScanProgressEvent }> =
        new Observable((subscriber) => {
          subscriber.next({ data: initialState });
          subscriber.complete();
        });

      const mergedStream: Observable<{
        data: ScanProgressEvent | ScanErrorEvent;
      }> = merge(initialStateStream, eventsStream, errorsStream) as Observable<{
        data: ScanProgressEvent | ScanErrorEvent;
      }>;

      return mergedStream.pipe(
        catchError((error): Observable<{ data: ScanErrorEvent }> => {
          console.error(
            `Fatal error in SSE stream for session ${sessionId}:`,
            error,
          );
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
      console.error(
        `Failed to create SSE stream for session ${sessionId}:`,
        error,
      );
      const errorEvent: ScanErrorEvent = {
        type: 'error',
        sessionId,
        timestamp: new Date().toISOString(),
        severity: 'error',
        source: 'backend',
        error: {
          code:
            error instanceof NotFoundException
              ? 'SESSION_NOT_FOUND'
              : 'STREAM_INIT_ERROR',
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
