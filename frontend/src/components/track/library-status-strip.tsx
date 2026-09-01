import { Progress } from '@/components/ui/progress';
import { useScanSessionContext } from '@/contexts/scan-session.context';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

/**
 * Page-context scan status, shown above the Music views only while a scan is
 * running. The global header badge (`ScanProgress`) covers the whole app; this
 * strip surfaces the same progress inline so it's visible without looking up.
 * Nothing renders when no scan is active — the Music view stays uncluttered.
 */
export function LibraryStatusStrip() {
  const { activeSessions } = useScanSessionContext();

  const active = React.useMemo(() => {
    const sessions = [...activeSessions.values()];
    if (sessions.length === 0) return null;
    const totalTracks = sessions.reduce((sum, s) => sum + (s.totalTracks || 0), 0);
    const completedTracks = sessions.reduce((sum, s) => sum + (s.completedTracks || 0), 0);
    // Prefer real track counts; fall back to the session's own progress value
    // (which the backend reports as a 0–100 percentage).
    const rawProgress =
      sessions.reduce((sum, s) => sum + (s.overallProgress || 0), 0) / sessions.length;
    const progress =
      totalTracks > 0
        ? Math.round((completedTracks / totalTracks) * 100)
        : Math.round(rawProgress > 1 ? rawProgress : rawProgress * 100);
    return { totalTracks, completedTracks, progress: Math.min(Math.max(progress, 0), 100) };
  }, [activeSessions]);

  if (!active) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
          Analyzing your library
        </span>
        <span className="font-mono text-muted-foreground">
          {active.totalTracks > 0
            ? `${active.completedTracks.toLocaleString()} / ${active.totalTracks.toLocaleString()}`
            : `${active.progress}%`}
        </span>
      </div>
      <Progress value={active.progress} className="h-1.5" aria-label="Scan progress" />
    </div>
  );
}
