import type { MusicLibrary } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useScanSessionContext } from '@/contexts/scan-session.context';
import { LibraryScanStatus } from '@/services/api-hooks';
import { useScanProgress } from '@/services/sse-service';
import { AlertCircle, BarChart3, FolderOpen, Music, Play } from 'lucide-react';
import React from 'react';

interface LibraryCardProps {
  library: MusicLibrary;
  onScan: (libraryId: string) => void;
  onView: (libraryId: string) => void;
  onPlay: (libraryId: string) => void;
  isScanning?: boolean;
}

const getScanStatusColor = (status: LibraryScanStatus) => {
  switch (status) {
    case 'IDLE':
      return 'bg-green-100 text-green-800';
    case 'SCANNING':
      return 'bg-blue-100 text-blue-800';
    case 'ANALYZING':
      return 'bg-yellow-100 text-yellow-800';
    case 'ERROR':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getScanStatusIcon = (status: LibraryScanStatus) => {
  switch (status) {
    case 'IDLE':
      return <Music className="h-4 w-4" />;
    case 'SCANNING':
      return <FolderOpen className="h-4 w-4" />;
    case 'ANALYZING':
      return <BarChart3 className="h-4 w-4" />;
    case 'ERROR':
      return <AlertCircle className="h-4 w-4" />;
    default:
      return <Music className="h-4 w-4" />;
  }
};

export const LibraryCard: React.FC<LibraryCardProps> = ({
  library,
  onScan,
  onView,
  onPlay,
  isScanning: isScanningProp = false,
}) => {
  const { getSessionForLibrary } = useScanSessionContext();
  const session = getSessionForLibrary(library.id);
  const { progress: scanProgress } = useScanProgress(session?.sessionId);

  // Calculate progress from scan progress event or library stats
  const analysisProgress = scanProgress?.data?.overallProgress
    ? scanProgress.data.overallProgress
    : library.totalTracks > 0
      ? (library.analyzedTracks / library.totalTracks) * 100
      : 0;

  // Use real-time scan progress if available, otherwise calculate from tracks

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const isScanning = session?.status === 'SCANNING' || isScanningProp;
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getScanStatusIcon(library.scanStatus as LibraryScanStatus)}
            <CardTitle className="text-lg">{library.name}</CardTitle>
          </div>
          <Badge
            className={getScanStatusColor(
              library.scanStatus as LibraryScanStatus,
            )}
          >
            {library.scanStatus}
          </Badge>
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          {library.rootPath}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {library.totalTracks}
            </div>
            <div className="text-sm text-muted-foreground">Total Tracks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {library.analyzedTracks}
            </div>
            <div className="text-sm text-muted-foreground">Analyzed</div>
          </div>
        </div>

        {/* Analysis Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Analysis Progress</span>
            <span>{Math.round(analysisProgress)}%</span>
          </div>
          <Progress value={analysisProgress} className="h-2" />
        </div>

        {/* Pending/Failed Tracks */}
        {(library.pendingTracks > 0 || library.failedTracks > 0) && (
          <div className="flex space-x-2">
            {library.pendingTracks > 0 && (
              <Badge variant="secondary" className="text-yellow-600">
                {library.pendingTracks} Pending
              </Badge>
            )}
            {library.failedTracks > 0 && (
              <Badge variant="destructive">{library.failedTracks} Failed</Badge>
            )}
          </div>
        )}

        {/* Last Scan Info */}
        <div className="text-sm text-muted-foreground">
          <div>Last Scan: {formatDate(library.lastScanAt)}</div>
          {library.lastIncrementalScanAt && (
            <div>
              Last Incremental: {formatDate(library.lastIncrementalScanAt)}
            </div>
          )}
        </div>

        {/* Settings Summary */}
        <div className="text-sm">
          <div className="flex items-center space-x-2">
            <span className="text-muted-foreground">Auto-scan:</span>
            <Badge
              variant={library.settings.autoScan ? 'default' : 'secondary'}
            >
              {library.settings.autoScan ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <div className="text-muted-foreground">
            Formats: {library.settings.supportedFormats.join(', ')}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(library.id)}
            className="flex-1"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            View Library
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onScan(library.id)}
            disabled={
              library.scanStatus === 'SCANNING' ||
              library.scanStatus === 'ANALYZING' ||
              isScanning
            }
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {isScanning ? 'Scanning...' : 'Scan'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPlay(library.id)}
          >
            <Play className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
