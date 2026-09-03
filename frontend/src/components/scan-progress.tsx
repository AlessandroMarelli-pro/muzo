import { Progress } from '@/components/ui/progress';
import { useScanSessionContext } from '@/contexts/scan-session.context';
import { useScanProgress } from '@/services/sse-service';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate, formatDuration, intervalToDuration } from 'date-fns';
import { Loader } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { ExternalToast, toast } from 'sonner';
import { FieldLabel } from './ui/field';
const toastOptions: ExternalToast = {
  duration: 5000,
  position: 'bottom-right',
};

/** Pick the most recently added active session so new track scans show up. */
function getLatestSessionId(
  activeSessions: Map<string, { sessionId: string }>,
): string | undefined {
  const values = [...activeSessions.values()];
  return values.length ? values[values.length - 1]?.sessionId : undefined;
}

/** "estimating…" while warming up, otherwise a rounded "~4 min remaining" / "~30s remaining". */
function formatEta(etaSeconds: number | null | undefined, confidence: string | undefined): string | null {
  if (confidence === 'warming-up' || etaSeconds === undefined) return null;
  if (etaSeconds === null) return null;
  if (etaSeconds < 60) return `~${etaSeconds}s remaining`;
  const minutes = Math.round(etaSeconds / 60);
  return `~${minutes} min remaining`;
}

export const ScanProgress = React.memo(() => {
  const queryClient = useQueryClient();
  const { activeSessions, completedSessions } = useScanSessionContext();

  const latestSessionId = getLatestSessionId(activeSessions);
  const { progress: scanProgress } = useScanProgress(latestSessionId);
  // overallProgress is a 0-100 percentage everywhere from the backend boundary onward -- see
  // ScanStateEvent.overallProgress in ScanProgress.types.ts. -1 means "no active session".
  const [progress, setProgress] = useState(
    () => [...activeSessions.values()].pop()?.overallProgress ?? -1,
  );
  const [eta, setEta] = useState<{ etaSeconds: number | null; confidence?: string } | null>(null);
  const [counts, setCounts] = useState<{ completed: number; total: number } | null>(null);
  // Track processed events to prevent duplicate toasts
  const processedEvents = useRef<Set<string>>(new Set());

  // Show progress bar as soon as we have an active session (e.g. new track scan)
  useEffect(() => {
    if (latestSessionId) {
      const session = activeSessions.get(latestSessionId);
      setProgress((prev) => (session ? session.overallProgress : Math.max(0, prev)));
      setEta(
        session
          ? { etaSeconds: session.etaSeconds ?? null, confidence: session.confidence }
          : null,
      );
      setCounts(
        session && session.totalTracks > 0
          ? { completed: session.completedTracks, total: session.totalTracks }
          : null,
      );
    } else {
      setProgress(-1);
      setEta(null);
      setCounts(null);
    }
  }, [latestSessionId, activeSessions]);

  useEffect(() => {
    const overallProgress = scanProgress?.overallProgress ?? undefined;
    if (overallProgress !== undefined && overallProgress !== null) {
      setProgress(overallProgress);
    }
    if (scanProgress?.type === 'state' && scanProgress.data) {
      setEta({
        etaSeconds: scanProgress.data.etaSeconds ?? null,
        confidence: scanProgress.data.confidence,
      });
      if (scanProgress.data.totalTracks) {
        setCounts({
          completed: scanProgress.data.completedTracks ?? 0,
          total: scanProgress.data.totalTracks,
        });
      }
    }
  }, [scanProgress]);

  // Handle scan.complete / track.complete events
  useEffect(() => {
    if (scanProgress?.type === 'scan.complete') {
      const eventKey = `scan.complete-${scanProgress.timestamp}`;
      if (!processedEvents.current.has(eventKey)) {
        const durationSec = scanProgress.data?.duration || 0;
        const duration = intervalToDuration({ start: 0, end: durationSec });
        processedEvents.current.add(eventKey);
        toast.success(`Scan completed in ${formatDuration(duration)}`, toastOptions);
        // Refetch all queries now that the async scan has finished
        void queryClient.invalidateQueries().then(() => queryClient.refetchQueries());
      }
    }
    if (scanProgress?.type === 'track.complete' && scanProgress.data) {
      const eventKey = `track.complete-${scanProgress.timestamp}-${scanProgress.data.trackIndex}`;
      if (!processedEvents.current.has(eventKey)) {
        processedEvents.current.add(eventKey);
        toast.success(`${scanProgress.data.fileName} complete`, {
          description: `Track ${scanProgress.data.trackIndex} of ${scanProgress.data.totalTracks} successfully processed`,
          ...toastOptions,
        });
      }
    }
  }, [scanProgress?.type, scanProgress?.timestamp]);

  const lastScan = completedSessions.values().next().value;
  const lastScanStartedAt = lastScan?.startedAt;
  const lastScanCompletedAt = lastScan?.completedAt;
  const duration =
    lastScanCompletedAt && lastScanStartedAt
      ? intervalToDuration({
          start: new Date(lastScanStartedAt).getTime(),
          end: new Date(lastScanCompletedAt).getTime(),
        })
      : undefined;

  const etaLabel = formatEta(eta?.etaSeconds, eta?.confidence);
  const roundedProgress = Math.round(progress);

  // No active session right now -- show the last-completed summary instead of the bar.
  const hasActiveScan = progress >= 0;

  return (
    <div className="flex flex-row gap-2 text-xs max-w-md w-full">
      {!hasActiveScan && lastScanCompletedAt && duration && (
        <div className="flex items-center justify-end gap-2 w-full">
          <span>
            Last scan completed: {formatDate(new Date(lastScanCompletedAt), 'MM/dd/yyyy HH:mm')} in{' '}
            {formatDuration(duration)}
          </span>
        </div>
      )}
      {hasActiveScan && (
        <div className="flex w-full flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <FieldLabel htmlFor="progress-scan" className="flex items-center gap-2">
              <Loader className="h-4 w-4 animate-spin" />
              <span>Scan</span>
            </FieldLabel>
            <span className="flex items-center gap-2 font-mono text-muted-foreground">
              {counts ? (
                <span>
                  {counts.completed.toLocaleString()} / {counts.total.toLocaleString()}
                </span>
              ) : (
                <span>{roundedProgress}%</span>
              )}
              {etaLabel && <span>{etaLabel}</span>}
              {eta?.confidence === 'warming-up' && !etaLabel && <span>estimating…</span>}
            </span>
          </div>
          <Progress id="progress-scan" value={roundedProgress} max={100} className="h-1 w-full" />
        </div>
      )}
    </div>
  );
});
