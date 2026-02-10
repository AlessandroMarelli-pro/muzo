import { Controller, Get, Logger, Param, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  ScanErrorEvent,
  ScanProgressEvent,
} from 'src/application/ports/dtos/ScanProgress.types';
import { GetActiveSessionsUseCase } from 'src/application/use-cases/scan-session/GetActiveSessions';
import { GetCompleteSessionsUseCase } from 'src/application/use-cases/scan-session/GetCompleteSessions';
import { StreamSessionUseCase } from 'src/application/use-cases/scan-session/StreamSession';
import { fromBase64Id } from '../../common/utils/id-encoding';
import { parseSessionId } from '../../common/utils/parse-id';
import { toHttpSession } from './scan-progress.mapper';

@Controller('scan-progress')
export class ScanProgressController {
  private readonly logger = new Logger(ScanProgressController.name);

  constructor(
    private readonly getCompleteSessionsUseCase: GetCompleteSessionsUseCase,
    private readonly getActiveSessionsUseCase: GetActiveSessionsUseCase,
    private readonly streamSessionUseCase: StreamSessionUseCase,
  ) {}

  /**
   * Get all active scan sessions
   * GET /scan-progress/active
   */
  @Get('active')
  async getActiveSessions() {
    return this.getActiveSessionsUseCase
      .execute()
      .then((sessions) => ({ data: sessions.map(toHttpSession) }));
  }

  /**
   * Get all completed scan sessions
   * GET /scan-progress/completed
   */
  @Get('completed')
  async getCompletedSessions() {
    return this.getCompleteSessionsUseCase
      .execute()
      .then((sessions) => ({ data: sessions.map(toHttpSession) }));
  }
  /**
   * SSE endpoint for scan progress updates
   * GET /api/scan-progress/:sessionId
   */
  @Sse(':sessionId')
  async streamProgress(
    @Param('sessionId') sessionId: string,
  ): Promise<Observable<{ data: ScanProgressEvent | ScanErrorEvent }>> {
    console.log('streamProgress', sessionId);
    return this.streamSessionUseCase.execute(
      parseSessionId(fromBase64Id(sessionId)),
    );
  }
}
