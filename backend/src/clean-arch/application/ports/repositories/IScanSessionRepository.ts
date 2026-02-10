import { SessionId } from 'src/clean-arch/kernel/ids';
import { ScanStatus, Session } from 'src/clean-arch/kernel/types/model-types';
import { createToken } from '../../utils/create-token';

export const SCAN_SESSION_REPOSITORY = createToken<IScanSessionRepository>(
  'SCAN_SESSION_REPOSITORY',
);

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
  createSession(sessionId: SessionId | null): Promise<Session>;
  updateSessionProgress(
    sessionId: SessionId,
    updates: UpdateScanSessionInput,
  ): Promise<Session>;
  getSession(sessionId: SessionId): Promise<Session>;
  completeSession(sessionId: SessionId, success: boolean): Promise<void>;
  getActiveSessions(): Promise<Session[]>;
  getCompletedSessions(): Promise<Session[]>;
}
