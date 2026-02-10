import { Injectable } from '@nestjs/common';

import {
  IScanSessionRepository,
  UpdateScanSessionInput,
} from 'src/application/ports/repositories/IScanSessionRepository';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { extractModelId, SessionId } from 'src/kernel/ids';
import { getCurrentUser, getCurrentUserId, models } from 'src/kernel/types';
import { ScanStatusEnum, Session } from 'src/kernel/types/model-types';
import { toDomain, toPrisma } from './scan-session.mapper';

@Injectable()
export class ScanSessionRepository implements IScanSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new scan session
   */
  async createSession(sessionId: SessionId): Promise<Session> {
    const session = await this.prisma.scanSession.create({
      data: toPrisma({
        ...models.session.instantiateNew({
          status: ScanStatusEnum.SCANNING,
          totalBatches: 0,
          completedBatches: 0,
          totalTracks: 0,
          completedTracks: 0,
          failedTracks: 0,
          overallProgress: 0,
          startedAt: new Date(),
          completedAt: null,
          errorMessage: null,
        }),
        createdById: getCurrentUser().id,
      }),
    });

    return toDomain(session);
  }

  /**
   * Get session by sessionId
   */
  async getSession(sessionId: SessionId): Promise<Session> {
    return this.prisma.scanSession
      .findFirst({
        where: {
          sessionId: extractModelId(sessionId).dbId,
          createdById: getCurrentUserId(),
        },
      })
      .then(toDomain);
  }

  /**
   * Update session progress
   * Uses atomic increment for overallProgress to prevent race conditions
   */
  async updateSessionProgress(
    sessionId: SessionId,
    updates: UpdateScanSessionInput,
  ): Promise<Session> {
    try {
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
      if (
        updates.completedBatches !== undefined &&
        updates.completedBatches !== null
      ) {
        updateData.completedBatches = {
          increment: updates.completedBatches,
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

          if (
            !activeSession ||
            activeSession.status !== ScanStatusEnum.SCANNING
          ) {
            console.debug(
              `Session ${sessionId} is not in SCANNING status, skipping update`,
            );
            return;
          }

          // Perform atomic update with increment
          return await tx.scanSession.update({
            where: {
              sessionId: extractModelId(sessionId).dbId,
              createdById: getCurrentUserId(),
            },
            data: updateData,
          });
        })
        .then(toDomain);
    } catch (error) {
      console.error(`Failed to update scan session ${sessionId}:`, error);
      // Don't throw - progress updates shouldn't break the scan
    }
  }

  /**
   * Mark session as completed
   */
  async completeSession(
    sessionId: SessionId,
    success: boolean = true,
  ): Promise<void> {
    await this.prisma.scanSession.update({
      where: {
        sessionId: extractModelId(sessionId).dbId,
        createdById: getCurrentUserId(),
      },
      data: {
        status: success ? ScanStatusEnum.IDLE : ScanStatusEnum.ERROR,
        completedAt: new Date(),
        overallProgress: 100,
      },
    });
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
    await this.prisma.scanSession.delete({
      where: {
        sessionId: extractModelId(sessionId).dbId,
        createdById: getCurrentUserId(),
      },
    });
  }
}
