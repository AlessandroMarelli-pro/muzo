import { Controller, Get, Logger, Param, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  ScanErrorEvent,
  ScanProgressEvent,
} from 'src/clean-arch/application/ports/dtos/ScanProgress.types';
import { GetActiveSessionsUseCase } from 'src/clean-arch/application/use-cases/scan-session/GetActiveSessions';
import { GetCompleteSessionsUseCase } from 'src/clean-arch/application/use-cases/scan-session/GetCompleteSessions';
import { StreamSessionUseCase } from 'src/clean-arch/application/use-cases/scan-session/StreamSession';
import { SessionId } from 'src/clean-arch/kernel/ids';

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
    return this.getActiveSessionsUseCase.execute();
  }

  /**
   * Get all completed scan sessions
   * GET /scan-progress/completed
   */
  @Get('completed')
  async getCompletedSessions() {
    return this.getCompleteSessionsUseCase.execute();
  }
  /**
   * SSE endpoint for scan progress updates
   * GET /api/scan-progress/:sessionId
   */
  @Sse(':sessionId')
  async streamProgress(
    @Param('sessionId') sessionId: string,
  ): Promise<Observable<{ data: ScanProgressEvent | ScanErrorEvent }>> {
    return this.streamSessionUseCase.execute(sessionId as SessionId);
  }
}
