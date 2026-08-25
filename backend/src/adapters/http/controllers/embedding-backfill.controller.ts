import { Body, Controller, HttpCode, HttpStatus, Inject, Logger, Post } from '@nestjs/common';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';
import { mapBetterAuthUserToContextUser } from 'src/infrastructure/auth/session-user.mapper';
import { BackfillTrackEmbeddingsUseCase } from 'src/application/use-cases';
import { models } from 'src/kernel/types';
import { als } from 'src/kernel/types/context';
import { ActionContext } from 'src/kernel/types/model-types';

export interface EmbeddingBackfillRequestBody {
  /** Optional: backfill just this one track (by its raw DB id) instead of every track missing an embedding. */
  trackId?: string;
  /** Optional: cap the number of tracks backfilled (ignored when trackId is provided). */
  limit?: number;
}

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
   * Body (optional): { trackId?: string, limit?: number } -- trackId is the raw DB id (e.g.
   * from `sqlite3`), not the base64 GraphQL id. When omitted, backfills every track missing an
   * embedding, optionally capped to `limit` of them (ignored when trackId is set).
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  trigger(@Body() body: EmbeddingBackfillRequestBody = {}): { accepted: true } {
    this.runAsRealUser(body).catch((err: Error) => {
      this.logger.error('Embedding backfill scheduling failed', err.stack ?? err.message);
    });

    return { accepted: true };
  }

  private async runAsRealUser(body: EmbeddingBackfillRequestBody): Promise<void> {
    const realUser = await this.getRealUser();
    const actionContext: ActionContext = { now: new Date(), user: realUser };
    const trackId = body.trackId ? models.musicTrack.id(body.trackId) : undefined;

    await als.run(actionContext, () =>
      this.backfillTrackEmbeddingsUseCase.execute(realUser, trackId, body.limit),
    );
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
