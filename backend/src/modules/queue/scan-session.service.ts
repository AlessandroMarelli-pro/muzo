import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ScanStatus } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';

export interface CreateScanSessionInput {
  libraryIds?: string[];
}

export interface UpdateScanSessionInput {
  totalBatches?: number;
  completedBatches?: number;
  totalTracks?: number;
  completedTracks?: number;
  failedTracks?: number;
  status?: ScanStatus;
  errorMessage?: string;
  progressPercentage?: number;
}

@Injectable()
export class ScanSessionService {
  private readonly logger = new Logger(ScanSessionService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create a new scan session
   */
  async createSession(
    sessionId: string,
  ): Promise<{ id: string; sessionId: string }> {
    try {
      const existingSession = await this.prisma.scanSession.findUnique({ where: { sessionId } });
      if (existingSession?.status === ScanStatus.SCANNING) {
        return { id: existingSession.id, sessionId: existingSession.sessionId };
      }
      if (existingSession?.status === ScanStatus.IDLE) {
        await this.prisma.scanSession.delete({ where: { sessionId } });
      }

      const session = await this.prisma.scanSession.create({
        data: {
          sessionId,
          status: ScanStatus.SCANNING,
          totalBatches: 0,
          completedBatches: 0,
          totalTracks: 0,
          completedTracks: 0,
          failedTracks: 0,
          overallProgress: 0,
        },
      });

      this.logger.log(`Created scan session: ${session.sessionId}`);
      return { id: session.id, sessionId: session.sessionId };
    } catch (error) {
      this.logger.error('Failed to create scan session:', error);
      throw error;
    }
  }

  /**
   * Get session by sessionId
   */
  async getSession(sessionId: string) {
    try {
      if (!sessionId) {
        return null;
      }
      const session = await this.prisma.scanSession.findUnique({
        where: { sessionId },
      });

      if (!session) {
        return null;
      }

      return session;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get scan session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Update session progress
   * Uses atomic increment for overallProgress to prevent race conditions
   */
  async updateSessionProgress(
    sessionId: string,
    updates: UpdateScanSessionInput,
  ): Promise<void> {
    try {
      this.logger.log(`Updating session progress for session ${sessionId}:`, updates);

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
        // Round the decimal percentage to integer for atomic increment
        // e.g., 0.5% -> 1, 0.3% -> 0, 0.7% -> 1
        const incrementValue = Math.round(progressPercentage);
        if (incrementValue !== 0) {
          updateData.overallProgress = {
            increment: incrementValue,
          };
        }
      }

      // Use a transaction to ensure atomicity and check session status
      await this.prisma.$transaction(async (tx) => {
        // First, verify the session exists and is in SCANNING status
        const activeSession = await tx.scanSession.findUnique({
          where: { sessionId },
          select: { status: true },
        });

        if (!activeSession || activeSession.status !== ScanStatus.SCANNING) {
          this.logger.debug(
            `Session ${sessionId} is not in SCANNING status, skipping update`,
          );
          return;
        }

        // Perform atomic update with increment
        await tx.scanSession.update({
          where: { sessionId },
          data: updateData,
        });
      });
    } catch (error) {
      this.logger.error(
        `Failed to update scan session ${sessionId}:`,
        error,
      );
      // Don't throw - progress updates shouldn't break the scan
    }
  }

  /**
   * Mark session as completed
   */
  async completeSession(
    sessionId: string,
    success: boolean = true,
  ): Promise<void> {
    try {
      this.logger.log(`Completing session ${sessionId}: ${success}`);
      await this.prisma.scanSession.update({
        where: { sessionId },
        data: {
          status: success ? ScanStatus.IDLE : ScanStatus.ERROR,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Scan session ${sessionId} marked as ${success ? 'completed' : 'failed'}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to complete scan session ${sessionId}:`,
        error,
      );
    }
  }

  /**
   * Mark session as failed with error message
   */
  async failSession(sessionId: string, errorMessage: string): Promise<void> {
    try {
      await this.prisma.scanSession.update({
        where: { sessionId },
        data: {
          status: ScanStatus.ERROR,
          errorMessage,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Scan session ${sessionId} marked as failed: ${errorMessage}`);
    } catch (error) {
      this.logger.error(`Failed to mark session ${sessionId} as failed:`, error);
    }
  }

  /**
   * Get all active scan sessions (SCANNING or ANALYZING)
   */
  async getActiveSessions() {
    try {
      const sessions = await this.prisma.scanSession.findMany({
        where: {
          status: {
            in: [ScanStatus.SCANNING, ScanStatus.ANALYZING],
          },
        },
        orderBy: {
          startedAt: 'desc',
        },
      });

      this.logger.log(`Found ${sessions.length} active scan sessions`);
      return sessions;
    } catch (error) {
      this.logger.error('Failed to get active scan sessions:', error);
      throw error;
    }
  }

  async getCompletedSessions() {
    try {
      const sessions = await this.prisma.scanSession.findMany({
        where: {
          status: ScanStatus.IDLE,
        },
        orderBy: {
          startedAt: 'desc',
        },
      });
      return sessions;
    } catch (error) {
      this.logger.error('Failed to get completed scan sessions:', error);
      throw error;
    }
  }

  /**
   * Generate a unique session ID (UUID v4)
   */
  private generateSessionId(): string {
    // Generate UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
