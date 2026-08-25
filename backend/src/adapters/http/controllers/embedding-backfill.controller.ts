import { Controller, HttpCode, HttpStatus, Inject, Logger, Post } from '@nestjs/common';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';
import { mapBetterAuthUserToContextUser } from 'src/infrastructure/auth/session-user.mapper';
import { BackfillTrackEmbeddingsUseCase } from 'src/application/use-cases';
import { als } from 'src/kernel/types/context';
import { ActionContext } from 'src/kernel/types/model-types';

/**
 * Internal support/ops route: fire-and-forget trigger to backfill the discogs-effnet embedding
 * for every already-analyzed track that doesn't have one yet. Intended for curl use, not the
 * frontend -- no response body beyond an immediate ack; check backend logs for outcome.
 *
 * Called via curl with no session cookie, so ActionContextMiddleware seeds the request's
 * AsyncLocalStorage context with the anonymous user by default. Repository queries scope to
 * createdById = current user, so this route resolves the one real (non-anonymous) user from the
 * DB and re-runs the use case inside its own ALS context, same pattern as
 * ScanTracksByCriteriaController.
 */
@Controller('ops/embedding-backfill')
export class EmbeddingBackfillController {
  private readonly logger = new Logger(EmbeddingBackfillController.name);

  constructor(
    private readonly backfillTrackEmbeddingsUseCase: BackfillTrackEmbeddingsUseCase,
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /ops/embedding-backfill
   * No request body -- always targets every track missing an embedding.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  trigger(): { accepted: true } {
    this.runAsRealUser().catch((err: Error) => {
      this.logger.error('Embedding backfill scheduling failed', err.stack ?? err.message);
    });

    return { accepted: true };
  }

  private async runAsRealUser(): Promise<void> {
    const realUser = await this.getRealUser();
    const actionContext: ActionContext = { now: new Date(), user: realUser };

    await als.run(actionContext, () => this.backfillTrackEmbeddingsUseCase.execute(realUser));
  }

  /** This is a single-tenant local app today: pick the one real (non-anonymous) user. */
  private async getRealUser(): Promise<ActionContext['user']> {
    const user = await this.prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!user) {
      throw new Error('No user found in the database; cannot resolve an owner for this backfill.');
    }
    return mapBetterAuthUserToContextUser(user);
  }
}
