import { Maybe } from 'src/kernel/common';
import { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { ScanStatus, Session } from 'src/kernel/types/model-types';
import { createToken } from '../../utils/create-token';

export const SCAN_SESSION_REPOSITORY =
  createToken<IScanSessionRepository>('SCAN_SESSION_REPOSITORY');

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

export interface IScanSessionRepository {
  /** libraryId: the single library this scan targets, or null for a criteria-scan spanning multiple libraries. */
  createSession(libraryId: MusicLibraryId | null): Promise<Session>;
  /**
   * Returns the user's existing active session if one exists (created: false), otherwise
   * atomically creates and returns a new one (created: true). Enforces at most one active
   * scan session per user, globally (not per-library).
   */
  getActiveSessionOrCreate(
    libraryId: MusicLibraryId | null,
  ): Promise<{ session: Session; created: boolean }>;
  updateSession(sessionId: SessionId, updates: UpdateScanSessionInput): Promise<Session>;
  /** Atomically adds to totalBatches/totalTracks rather than overwriting them. */
  incrementSessionTotals(
    sessionId: SessionId,
    delta: { totalBatches?: number; totalTracks?: number },
  ): Promise<Session>;
  updateSessionProgress(
    sessionId: SessionId,
    updates: UpdateScanSessionInput,
  ): Promise<Session | null>;
  getSession(sessionId: SessionId): Promise<Maybe<Session>>;
  completeSession(sessionId: SessionId, success: boolean): Promise<Session>;
  getActiveSessions(): Promise<Session[]>;
  getCompletedSessions(): Promise<Session[]>;
  deleteSession(sessionId: SessionId): Promise<void>;
  deleteAllSessionsForLibrary(libraryId: MusicLibraryId): Promise<void>;
}
