import { Session } from 'src/kernel/types/model-types';
import { toBase64Id } from '../../common/utils/id-encoding';

export const toHttpSession = (session: Session) => {
  return {
    id: toBase64Id(session.id),
    sessionId: toBase64Id(session.id),
    libraryId: session.libraryId ? toBase64Id(session.libraryId) : undefined,
    status: session.status,
    totalBatches: session.totalBatches,
    completedBatches: session.completedBatches,
    totalTracks: session.totalTracks,
    completedTracks: session.completedTracks,
    failedTracks: session.failedTracks,
    overallProgress: session.overallProgress,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString(),
  };
};
