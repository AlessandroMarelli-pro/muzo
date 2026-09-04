import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  IScanSessionRepository,
  UpdateScanSessionInput,
} from 'src/application/ports/repositories/IScanSessionRepository';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';
import { extractModelId, MusicLibraryId, SessionId } from 'src/kernel/ids';
import { getCurrentUserId, Maybe, models } from 'src/kernel/types';
import { ScanStatusEnum, Session } from 'src/kernel/types/model-types';
import { toDomain, toPrisma, toPrismaUpdate } from './scan-session.mapper';

@Injectable()
export class ScanSessionRepository implements IScanSessionRepository {
  private readonly logger = new Logger(ScanSessionRepository.name);

  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  /**
   * Create a new scan session
   */
  async createSession(libraryId: MusicLibraryId | null): Promise<Session> {
    const session = await this.prisma.scanSession.create({
      data: toPrisma({
        ...models.session.instantiateNew({
          status: ScanStatusEnum.SCANNING,
          libraryId: libraryId ?? undefined,
          totalBatches: 0,
          completedBatches: 0,
          totalTracks: 0,
          completedTracks: 0,
          failedTracks: 0,
          overallProgress: 0,
          startedAt: new Date(),
          completedAt: undefined,
          errorMessage: undefined,
        }),
      }),
    });

    return toDomain(session);
  }

  /**
   * Enforce at most one active (SCANNING/ANALYZING) session per user: if one already
   * exists, return it instead of creating a new one. Check-then-create happens inside a
   * single transaction so two concurrent calls can't both pass the check.
   */
  async getActiveSessionOrCreate(
    libraryId: MusicLibraryId | null,
  ): Promise<{ session: Session; created: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.scanSession.findFirst({
        where: {
          createdById: getCurrentUserId(),
          status: { in: [ScanStatusEnum.SCANNING, ScanStatusEnum.ANALYZING] },
        },
        orderBy: { startedAt: 'desc' },
      });

      if (existing) {
        return { session: toDomain(existing), created: false };
      }

      const created = await tx.scanSession.create({
        data: toPrisma({
          ...models.session.instantiateNew({
            status: ScanStatusEnum.SCANNING,
            libraryId: libraryId ?? undefined,
            totalBatches: 0,
            completedBatches: 0,
            totalTracks: 0,
            completedTracks: 0,
            failedTracks: 0,
            overallProgress: 0,
            startedAt: new Date(),
            completedAt: undefined,
            errorMessage: undefined,
          }),
        }),
      });

      return { session: toDomain(created), created: true };
    });
  }

  async updateSession(sessionId: SessionId, updates: UpdateScanSessionInput): Promise<Session> {
    return this.prisma.scanSession
      .update({
        where: {
          sessionId: extractModelId(sessionId).dbId,
          createdById: getCurrentUserId(),
        },
        data: toPrismaUpdate(updates),
      })
      .then(toDomain);
  }

  /**
   * Atomically adds to totalBatches/totalTracks instead of overwriting them, so scheduling
   * a scan across multiple libraries under one session (e.g. a criteria scan) accumulates
   * the correct grand total instead of the last call's write clobbering earlier ones.
   */
  async incrementSessionTotals(
    sessionId: SessionId,
    delta: { totalBatches?: number; totalTracks?: number },
  ): Promise<Session> {
    return this.prisma.scanSession
      .update({
        where: {
          sessionId: extractModelId(sessionId).dbId,
          createdById: getCurrentUserId(),
        },
        data: {
          ...(delta.totalBatches !== undefined && {
            totalBatches: { increment: delta.totalBatches },
          }),
          ...(delta.totalTracks !== undefined && {
            totalTracks: { increment: delta.totalTracks },
          }),
          updatedAt: new Date(),
        },
      })
      .then(toDomain);
  }

  /**
   * Get session by sessionId
   */
  async getSession(sessionId: SessionId): Promise<Maybe<Session>> {
    return this.prisma.scanSession
      .findFirst({
        where: {
          sessionId: extractModelId(sessionId).dbId,
          createdById: getCurrentUserId(),
        },
      })
      .then((row) => (row ? toDomain(row) : null));
  }

  /**
   * Update session progress.
   *
   * completedBatches/completedTracks/failedTracks are applied as atomic increments.
   * overallProgress is *derived*, not incremented: it is recomputed from
   * completedBatches/totalBatches after the increments are applied, inside the same
   * transaction. Deriving it (instead of adding a precomputed per-batch increment, as
   * this used to do) avoids two real bugs that increment-based tracking had: rounding
   * error across many small increments never quite summing to 10000, and a growing
   * totalBatches denominator (criteria scans call incrementSessionTotals more than once
   * per session) silently invalidating increments that were already applied.
   */
  async updateSessionProgress(
    sessionId: SessionId,
    updates: UpdateScanSessionInput,
  ): Promise<Session | null> {
    const updateData: any = {
      ...updates,
      updatedAt: new Date(),
    };

    if (updates.completedBatches !== undefined && updates.completedBatches !== null) {
      updateData.completedBatches = {
        increment: updates.completedBatches,
      };
    }
    if (updates.completedTracks !== undefined && updates.completedTracks !== null) {
      updateData.completedTracks = {
        increment: updates.completedTracks,
      };
    }
    if (updates.failedTracks !== undefined && updates.failedTracks !== null) {
      updateData.failedTracks = {
        increment: updates.failedTracks,
      };
    }

    // Use a transaction to ensure atomicity and check session status
    return this.prisma
      .$transaction(async (tx) => {
        // First, verify the session exists and is in SCANNING status
        const activeSession = await tx.scanSession.findUnique({
          where: {
            sessionId: extractModelId(sessionId).dbId,
            createdById: getCurrentUserId(),
          },
          select: { status: true },
        });

        if (!activeSession || activeSession.status !== ScanStatusEnum.SCANNING) {
          this.logger.warn(
            `Dropped progress update for session ${sessionId}: session is ${
              activeSession ? `in status ${activeSession.status}` : 'missing'
            }, not SCANNING`,
          );
          return null;
        }

        const updated = await tx.scanSession.update({
          where: {
            sessionId: extractModelId(sessionId).dbId,
            createdById: getCurrentUserId(),
          },
          data: updateData,
        });

        // Derive overallProgress (basis points, 0-10000) from the post-increment row.
        if (updated.totalBatches > 0) {
          const derivedProgress = Math.min(
            10000,
            Math.round((updated.completedBatches / updated.totalBatches) * 10000),
          );
          if (derivedProgress !== updated.overallProgress) {
            return tx.scanSession.update({
              where: {
                sessionId: extractModelId(sessionId).dbId,
                createdById: getCurrentUserId(),
              },
              data: { overallProgress: derivedProgress },
            });
          }
        }

        return updated;
      })
      .then((result) => (result ? toDomain(result) : null))
      .catch((error) => {
        this.logger.error(`Error updating progress for session ${sessionId}`, error);
        throw error;
      });
  }

  /**
   * Mark session as completed
   */
  async completeSession(sessionId: SessionId, success: boolean = true): Promise<Session> {
    return this.prisma.scanSession
      .update({
        where: {
          sessionId: extractModelId(sessionId).dbId,
          createdById: getCurrentUserId(),
        },
        data: {
          status: success ? ScanStatusEnum.IDLE : ScanStatusEnum.ERROR,
          completedAt: new Date(),
          overallProgress: 10000,
        },
      })
      .then(toDomain);
  }

  /**
   * Get all active scan sessions (SCANNING or ANALYZING)
   */
  async getActiveSessions() {
    return this.prisma.scanSession
      .findMany({
        where: {
          status: {
            in: [ScanStatusEnum.SCANNING, ScanStatusEnum.ANALYZING],
          },
          createdById: getCurrentUserId(),
        },
        orderBy: {
          startedAt: 'desc',
        },
      })
      .then((sessions) => sessions.map(toDomain));
  }

  /**
   * Unscoped: counts across every user, not just the current one. See the port doc for why.
   */
  async hasAnyActiveSession(): Promise<boolean> {
    const count = await this.prisma.scanSession.count({
      where: {
        status: { in: [ScanStatusEnum.SCANNING, ScanStatusEnum.ANALYZING] },
      },
    });
    return count > 0;
  }

  async getCompletedSessions() {
    return this.prisma.scanSession
      .findMany({
        where: {
          status: ScanStatusEnum.IDLE,
          createdById: getCurrentUserId(),
        },
        orderBy: {
          startedAt: 'desc',
        },
      })
      .then((sessions) => sessions.map(toDomain));
  }

  async deleteSession(sessionId: SessionId): Promise<void> {
    await this.prisma.scanSession.delete({
      where: {
        sessionId: extractModelId(sessionId).dbId,
        createdById: getCurrentUserId(),
      },
    });
  }

  async deleteAllSessionsForLibrary(libraryId: MusicLibraryId): Promise<void> {
    await this.prisma.scanSession.deleteMany({
      where: {
        createdById: getCurrentUserId(),
        libraryId: extractModelId(libraryId).dbId,
      },
    });
  }
}
