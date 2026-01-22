import {
    Controller,
    Get,
    Logger,
    NotFoundException,
    Param,
    Sse,
} from '@nestjs/common';
import { EMPTY, Observable, merge } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ScanProgressPubSubService } from './scan-progress-pubsub.service';
import { ScanErrorEvent, ScanProgressEvent } from './scan-progress.types';
import { ScanSessionService } from './scan-session.service';

@Controller('scan-progress')
export class ScanProgressController {
    private readonly logger = new Logger(ScanProgressController.name);

    constructor(
        private readonly scanSessionService: ScanSessionService,
        private readonly pubSubService: ScanProgressPubSubService,
    ) { }

    /**
     * Get all active scan sessions
     * GET /scan-progress/active
     */
    @Get('active')
    async getActiveSessions() {
        try {
            const sessions = await this.scanSessionService.getActiveSessions();
            return sessions.map((session) => ({
                sessionId: session.sessionId,
                status: session.status,
                totalBatches: session.totalBatches,
                completedBatches: session.completedBatches,
                totalTracks: session.totalTracks,
                completedTracks: session.completedTracks,
                failedTracks: session.failedTracks,
                startedAt: session.startedAt,
                updatedAt: session.updatedAt,
                overallProgress: this.calculateProgress(session),
            }));
        } catch (error) {
            this.logger.error('Failed to get active sessions:', error);
            throw error;
        }
    }

    /**
     * SSE endpoint for scan progress updates
     * GET /api/scan-progress/:sessionId
     */
    @Sse(':sessionId')
    async streamProgress(
        @Param('sessionId') sessionId: string,
    ): Promise<Observable<{ data: ScanProgressEvent | ScanErrorEvent }>> {
        try {
            // Verify session exists
            const session = await this.scanSessionService.getSession(sessionId);
            if (!session) {
                return EMPTY;
            }

            // Subscribe to events (non-blocking)
            await this.pubSubService.subscribeToSession(sessionId);

            // Get initial state
            const currentState = await this.pubSubService.getCurrentState(sessionId);
            const initialState: ScanProgressEvent = currentState
                ? {
                    type: 'state',
                    sessionId,
                    timestamp: new Date().toISOString(),
                    data: currentState,
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
                        overallProgress: this.calculateProgress(session),
                        startedAt: session.startedAt.toISOString(),
                        updatedAt: session.updatedAt.toISOString(),
                    },
                };

            // Create event stream
            const eventsStream: Observable<{ data: ScanProgressEvent | ScanErrorEvent }> = this.pubSubService
                .getEventStream(sessionId)
                .pipe(
                    map((event) => ({ data: event })),
                    catchError((error) => {
                        this.logger.error(
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
            const errorsStream: Observable<{ data: ScanErrorEvent }> = this.pubSubService
                .getErrorStream(sessionId)
                .pipe(
                    map((error) => ({ data: error })),
                    catchError((error) => {
                        this.logger.error(
                            `Error in error stream for session ${sessionId}:`,
                            error,
                        );
                        return EMPTY;
                    }),
                );

            // Merge all streams: start with initial state, then merge events and errors
            // NestJS handles connection management, so keep-alive is not needed
            const initialStateStream: Observable<{ data: ScanProgressEvent }> = new Observable((subscriber) => {
                subscriber.next({ data: initialState });
                subscriber.complete();
            });

            const mergedStream: Observable<{ data: ScanProgressEvent | ScanErrorEvent }> = merge(
                initialStateStream,
                eventsStream,
                errorsStream,
            ) as Observable<{ data: ScanProgressEvent | ScanErrorEvent }>;

            return mergedStream.pipe(
                catchError((error): Observable<{ data: ScanErrorEvent }> => {
                    this.logger.error(
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
            this.logger.error(
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

    /**
     * Calculate overall progress percentage
     */
    private calculateProgress(session: any): number {
        if (session.totalTracks === 0) {
            return 0;
        }
        return Math.round(
            ((session.completedTracks + session.failedTracks) /
                session.totalTracks) *
            100,
        );
    }
}
