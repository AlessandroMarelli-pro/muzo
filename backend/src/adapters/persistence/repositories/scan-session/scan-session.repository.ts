import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  IScanSessionRepository,
  UpdateScanSessionInput,
} from 'src/application/ports/repositories/IScanSessionRepository';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';
import { extractModelId, MusicLibraryId, SessionId } from 'src/kernel/ids';
import { getCurrentUserId, Maybe, models } from 'src/kernel/types';
import { ScanStatusEnum, Session } from 'src/kernel/types/model-types';
import { retryOnSqliteBusy } from '../retry-on-sqlite-busy';
import { toDomain, toPrisma, toPrismaUpdate } from './scan-session.mapper';

@Injectable()
export class ScanSessionRepository implements IScanSessionRepository {
  private readonly logger = new Logger(ScanSessionRepository.name);

  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  /**
   * Create a new scan session
   */
  async createSession(libraryId: MusicLibraryId | null): Promise<Session> {
    const session = await retryOnSqliteBusy(
      () =>
        this.prisma.scanSession.create({
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
        }),
      this.logger,
      'createSession',
    );

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
    return retryOnSqliteBusy(
      () =>
        this.prisma.$transaction(async (tx) => {
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
        }),
      this.logger,
      'getActiveSessionOrCreate',
    );
  }

  async updateSession(sessionId: SessionId, updates: UpdateScanSessionInput): Promise<Session> {
    return retryOnSqliteBusy(
      () =>
        this.prisma.scanSession.update({
          where: {
            sessionId: extractModelId(sessionId).dbId,
            createdById: getCurrentUserId(),
          },
          data: toPrismaUpdate(updates),
        }),
      this.logger,
      'updateSession',
    ).then(toDomain);
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
    return retryOnSqliteBusy(
      () =>
        this.prisma.scanSession.update({
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
        }),
      this.logger,
      'incrementSessionTotals',
    ).then(toDomain);
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
   * Update session progress
   * Uses atomic increment for overallProgress to prevent race conditions
   */
  async updateSessionProgress(
    sessionId: SessionId,
    updates: UpdateScanSessionInput,
  ): Promise<Session | null> {
    // Extract progressPercentage before modifying updates object
    const progressPercentage = updates.progressPercentage;
    delete updates.progressPercentage;

    // Prepare update data with atomic increment for overallProgress
    const updateData: any = {
      ...updates,
      updatedAt: new Date(),
    };

    // Use atomic increment if progressPercentage is provided
    // progressPercentage is a decimal (e.g., 0.5 for 0.5%)
    // overallProgress is stored as Int representing percentage (0-100)
    // We increment by rounding the decimal percentage to the nearest integer
    if (progressPercentage !== undefined && progressPercentage !== null) {
      // Convert the decimal percentage to integer for atomic increment
      const incrementValue = progressPercentage;
      if (incrementValue !== 0) {
        updateData.overallProgress = {
          increment: incrementValue,
        };
      }
    }
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
    return retryOnSqliteBusy(
      () =>
        this.prisma.$transaction(async (tx) => {
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

          // Perform atomic update with increment
          return await tx.scanSession.update({
            where: {
              sessionId: extractModelId(sessionId).dbId,
              createdById: getCurrentUserId(),
            },
            data: updateData,
          });
        }),
      this.logger,
      'updateSessionProgress',
    )
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
    return retryOnSqliteBusy(
      () =>
        this.prisma.scanSession.update({
          where: {
            sessionId: extractModelId(sessionId).dbId,
            createdById: getCurrentUserId(),
          },
          data: {
            status: success ? ScanStatusEnum.IDLE : ScanStatusEnum.ERROR,
            completedAt: new Date(),
            overallProgress: 10000,
          },
        }),
      this.logger,
      'completeSession',
    ).then(toDomain);
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
    await retryOnSqliteBusy(
      () =>
        this.prisma.scanSession.delete({
          where: {
            sessionId: extractModelId(sessionId).dbId,
            createdById: getCurrentUserId(),
          },
        }),
      this.logger,
      'deleteSession',
    );
  }

  async deleteAllSessionsForLibrary(libraryId: MusicLibraryId): Promise<void> {
    await retryOnSqliteBusy(
      () =>
        this.prisma.scanSession.deleteMany({
          where: {
            createdById: getCurrentUserId(),
            libraryId: extractModelId(libraryId).dbId,
          },
        }),
      this.logger,
      'deleteAllSessionsForLibrary',
    );
  }
}
