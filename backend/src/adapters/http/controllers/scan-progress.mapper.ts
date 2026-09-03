import { Session } from 'src/kernel/types/model-types';
import { estimateCompletion } from 'src/application/use-cases/scan-session/estimate-completion';
import { toBase64Id } from '../../common/utils/id-encoding';

export const toHttpSession = (session: Session) => {
  const eta = estimateCompletion({
    startedAt: session.startedAt,
    completedTracks: session.completedTracks,
    failedTracks: session.failedTracks,
    totalTracks: session.totalTracks,
  });

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
    // session.overallProgress is basis points (0-10000) in the DB; convert to a 0-100
    // percentage here, at the boundary, so every client-side consumer speaks one unit.
    overallProgress: session.overallProgress / 100,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString(),
    etaSeconds: eta.etaSeconds,
    tracksPerSecond: eta.tracksPerSecond,
    confidence: eta.confidence,
    elapsedSeconds: eta.elapsedSeconds,
  };
};
