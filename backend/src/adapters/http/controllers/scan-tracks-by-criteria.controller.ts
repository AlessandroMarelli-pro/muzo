import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ScheduleTracksByCriteriaScanUseCase } from 'src/application/use-cases';
import { FilterCriteria } from 'src/kernel/types/model-types';

export interface ScanTracksByCriteriaRequestBody {
  criteria: FilterCriteria;
  force?: boolean;
  skipAiMetadata?: boolean;
  subgenreSelectionMode?: 'exact' | 'contain';
  limit?: number;
}

/**
 * Internal support/ops route: fire-and-forget trigger to (re-)schedule DSP analysis for all
 * tracks matching a criteria. Intended for curl use, not the frontend -- no response body
 * beyond an immediate ack; check backend logs or GET /scan-progress/active for outcome.
 */
@Controller('ops/scan-tracks-by-criteria')
export class ScanTracksByCriteriaController {
  private readonly logger = new Logger(ScanTracksByCriteriaController.name);

  constructor(
    private readonly scheduleTracksByCriteriaScanUseCase: ScheduleTracksByCriteriaScanUseCase,
  ) {}

  /**
   * POST /ops/scan-tracks-by-criteria
   * Body: { criteria: FilterCriteria, force?: boolean, skipAiMetadata?: boolean,
   *         subgenreSelectionMode?: 'exact' | 'contain', limit?: number }
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  trigger(@Body() body: ScanTracksByCriteriaRequestBody): { accepted: true } {
    // Fire-and-forget: scheduling runs in the background, errors only surface in logs.
    this.scheduleTracksByCriteriaScanUseCase
      .execute(body.criteria, {
        force: body.force ?? false,
        skipAiMetadata: body.skipAiMetadata ?? true,
        subgenreSelectionMode: body.subgenreSelectionMode ?? 'exact',
        limit: body.limit,
      })
      .catch((err: Error) => {
        this.logger.error('Criteria-based scan scheduling failed', err.stack ?? err.message);
      });

    return { accepted: true };
  }
}
