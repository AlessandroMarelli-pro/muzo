import { Body, Controller, HttpCode, HttpStatus, Inject, Logger, Post } from '@nestjs/common';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';
import { mapBetterAuthUserToContextUser } from 'src/infrastructure/auth/session-user.mapper';
import { ScheduleTracksByCriteriaScanUseCase } from 'src/application/use-cases';
import { als } from 'src/kernel/types/context';
import { ActionContext, FilterCriteria } from 'src/kernel/types/model-types';

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
 *
 * Called via curl with no session cookie, so ActionContextMiddleware seeds the request's
 * AsyncLocalStorage context with the anonymous user by default. All repository queries
 * (including getManyByCriteria) scope to createdById = current user, so running as anonymous
 * would silently match zero tracks -- the real library is owned by the actual account. This
 * route instead resolves the one real (non-anonymous) user from the DB and re-runs the
 * scheduling call inside its own ALS context, so it operates on real data.
 */
@Controller('ops/scan-tracks-by-criteria')
export class ScanTracksByCriteriaController {
  private readonly logger = new Logger(ScanTracksByCriteriaController.name);

  constructor(
    private readonly scheduleTracksByCriteriaScanUseCase: ScheduleTracksByCriteriaScanUseCase,
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
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
    this.runAsRealUser(body).catch((err: Error) => {
      this.logger.error('Criteria-based scan scheduling failed', err.stack ?? err.message);
    });

    return { accepted: true };
  }

  private async runAsRealUser(body: ScanTracksByCriteriaRequestBody): Promise<void> {
    const realUser = await this.getRealUser();
    const actionContext: ActionContext = { now: new Date(), user: realUser };

    await als.run(actionContext, () =>
      this.scheduleTracksByCriteriaScanUseCase.execute(body.criteria, {
        force: body.force ?? false,
        skipAiMetadata: body.skipAiMetadata ?? true,
        subgenreSelectionMode: body.subgenreSelectionMode ?? 'contain',
        limit: body.limit,
      }),
    );
  }

  /** This is a single-tenant local app today: pick the one real (non-anonymous) user. */
  private async getRealUser(): Promise<ActionContext['user']> {
    const user = await this.prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!user) {
      throw new Error('No user found in the database; cannot resolve an owner for this scan.');
    }
    return mapBetterAuthUserToContextUser(user);
  }
}
