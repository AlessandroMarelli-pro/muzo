import { Session } from 'src/kernel/types/model-types';
import { toBase64Id } from '../../common/utils/id-encoding';

export const toHttpSession = (session: Session) => {
  return {
    id: toBase64Id(session.id),
    sessionId: toBase64Id(session.id),
    status: session.status,
    totalBatches: session.totalBatches,
    completedBatches: session.completedBatches,
    totalTracks: session.totalTracks,
    completedTracks: session.completedTracks,
    failedTracks: session.failedTracks,
  };
};
