import type { Library } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { useScanSessionContext } from '@/contexts/scan-session.context';
import { cn } from '@/lib/utils';
import { LibraryScanStatus } from '@/services/api-hooks';
import { StopIcon } from '@radix-ui/react-icons';
import {
  AlertTriangle,
  BarChart3,
  Loader,
  MoreHorizontal,
  PauseCircle,
  Play,
  RefreshCw,
  Sparkles,
  Trash,
} from 'lucide-react';
import React from 'react';

interface LibraryCardProps {
  library: Library;
  onScan: (e: React.MouseEvent<HTMLButtonElement>, libraryId: string) => void;
  onForceScan: (e: React.MouseEvent<HTMLButtonElement>, libraryId: string) => void;
  onScanIncompleteTracks: (e: React.MouseEvent<HTMLButtonElement>, libraryId: string) => void;
  onView: (libraryId: string) => void;
  onPlay: (libraryId: string) => void;
  isScanning?: boolean;
  onDelete: (e: React.MouseEvent<HTMLButtonElement>, libraryId: string) => void;
  onStopScan: (
    e: React.MouseEvent<HTMLButtonElement>,
    libraryId: string,
    sessionId: string,
  ) => void;
}

const getScanStatusColor = (status: LibraryScanStatus) => {
  switch (status) {
    case 'SCANNING':
    case 'ANALYZING':
      return 'border-info-border bg-info-surface text-info-foreground';
    case 'ERROR':
      return 'border-transparent bg-destructive/10 text-destructive';
    case 'PAUSED':
      return 'border-warning-border bg-warning-surface text-warning-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const Stat = ({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: 'destructive';
}) => (
  <div className="space-y-0.5">
    <p
      className={cn(
        'font-medium font-mono text-base leading-none',
        emphasis === 'destructive' && 'text-destructive',
      )}
    >
      {value.toLocaleString()}
    </p>
    <p className="text-[0.65rem] text-muted-foreground uppercase tracking-wide">{label}</p>
  </div>
);

export const LibraryCard: React.FC<LibraryCardProps> = ({
  library,
  onScan,
  onForceScan,
  onScanIncompleteTracks,
  onView,
  onPlay,
  isScanning: isScanningProp = false,
  onDelete,
  onStopScan,
}) => {
  const { getSessionForLibrary } = useScanSessionContext();
  const session = getSessionForLibrary(library.id);
  // ScanSessionContext keeps this session's status/progress live via SSE, so it's the single
  // source of truth here -- no separate local copy that could drift from it.
  const scanStatus: LibraryScanStatus =
    (session?.status as LibraryScanStatus) ?? library.scanStatus;
  // ScanSession.overallProgress leaves the backend as a 0-100 percentage (basis points in
  // the DB are converted at the boundary -- see scan-progress.mapper.ts), so it's used as-is.
  const scanProgress = session?.overallProgress ?? 0;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const isScanning = scanStatus === 'SCANNING' || isScanningProp;
  const totalTracks = library.totalTracks;
  // Tracks whose analysisStatus is not COMPLETED (FAILED / PENDING / PROCESSING) -- what the
  // "scan incomplete tracks" action re-processes. failedTracks is kept broadened to this by the
  // backend, but derive it from the totals here so it holds even against an older cache.
  const incompleteTracks = Math.max(totalTracks - library.analyzedTracks, 0);
  // At rest the bar reports how much of the library has been analysed, so it stays meaningful
  // between scans rather than sitting empty.
  const analysedPercent =
    totalTracks > 0 ? Math.round((library.analyzedTracks / totalTracks) * 100) : 0;
  const progressValue = isScanning ? scanProgress : analysedPercent;

  type CardMouseEvent = React.MouseEvent<HTMLButtonElement | HTMLDivElement>;

  const handleDelete = (e: CardMouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete(e as React.MouseEvent<HTMLButtonElement>, library.id);
  };
  const handleScan = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    onScan(e, library.id);
  };
  const handleForceScan = (e: CardMouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onForceScan(e as React.MouseEvent<HTMLButtonElement>, library.id);
  };
  const handleScanIncompleteTracks = (e: CardMouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onScanIncompleteTracks(e as React.MouseEvent<HTMLButtonElement>, library.id);
  };
  const handlePlay = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    onPlay(library.id);
  };
  const handleStopScan = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    onStopScan(e, library.id, session?.sessionId ?? '');
  };

  return (
    <Card className="flex flex-col gap-0 transition-colors hover:border-primary/40">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* A button, so opening the library is reachable by keyboard -- the old card put
                the click handler on the card <div> with no focus or key handling. */}
            <button
              type="button"
              onClick={() => onView(library.id)}
              className="truncate rounded-sm text-left font-semibold text-lg capitalize leading-tight hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={library.name}
            >
              {library.name}
            </button>
            <p className="truncate text-muted-foreground text-xs" title={library.rootPath}>
              {library.rootPath}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {scanStatus !== 'IDLE' && (
              <Badge className={cn('gap-1 text-xs capitalize', getScanStatusColor(scanStatus))}>
                {isScanning && <Loader className="h-3 w-3 animate-spin" aria-hidden />}
                {scanStatus === 'ANALYZING' && !isScanning && (
                  <Sparkles className="h-3 w-3" aria-hidden />
                )}
                {scanStatus === 'PAUSED' && <PauseCircle className="h-3 w-3" aria-hidden />}
                {scanStatus === 'ERROR' && <AlertTriangle className="h-3 w-3" aria-hidden />}
                {scanStatus.toLowerCase()}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="iconSm" aria-label={`Actions for ${library.name}`}>
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleForceScan} disabled={isScanning}>
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                  Force scan
                </DropdownMenuItem>
                {incompleteTracks > 0 && (
                  <DropdownMenuItem onClick={handleScanIncompleteTracks} disabled={isScanning}>
                    <AlertTriangle className="mr-2 h-4 w-4 text-destructive" aria-hidden />
                    Retry {incompleteTracks.toLocaleString()} incomplete
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash className="mr-2 h-4 w-4" aria-hidden />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {/* Counts the API already returns but the card never showed. */}
        <div className="flex items-start gap-6">
          <Stat label="Tracks" value={totalTracks} />
          <Stat label="Analysed" value={library.analyzedTracks} />
          {incompleteTracks > 0 && (
            <Stat label="Incomplete" value={incompleteTracks} emphasis="destructive" />
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{isScanning ? 'Scanning…' : 'Analysed'}</span>
            <span className="font-mono">{progressValue}%</span>
          </div>
          <Progress
            value={progressValue}
            max={100}
            className="h-1.5"
            aria-label={isScanning ? 'Scan progress' : 'Analysed coverage'}
          />
        </div>

        <p className="text-muted-foreground text-xs">
          Last scan: {formatDate(library.lastScanAt)}
          {library.lastIncrementalScanAt &&
            ` · Incremental: ${formatDate(library.lastIncrementalScanAt)}`}
        </p>

        <div className="mt-auto flex w-full gap-2 pt-1">
          <Button
            variant="outline"
            className="w-full"
            size="sm"
            disabled={isScanningProp && !isScanning}
            onClick={isScanning ? handleStopScan : handleScan}
          >
            {isScanning ? (
              <StopIcon className="h-4 w-4" aria-hidden />
            ) : (
              <BarChart3 className="h-4 w-4" aria-hidden />
            )}
            {isScanning ? 'Stop' : 'Scan'}
          </Button>
          <Button variant="outline" size="sm" className="w-full" onClick={handlePlay}>
            <Play className="h-4 w-4" aria-hidden /> Play
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
