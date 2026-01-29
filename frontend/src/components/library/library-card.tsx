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
import { useScanSessionContext } from '@/contexts/scan-session.context';
import { LibraryScanStatus } from '@/services/api-hooks';
import { useScanProgress } from '@/services/sse-service';
import { BarChart3, Loader, Play, Trash } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface LibraryCardProps {
  library: MusicLibrary;
  onScan: (e: React.MouseEvent<HTMLButtonElement>, libraryId: string) => void;
  onView: (libraryId: string) => void;
  onPlay: (libraryId: string) => void;
  isScanning?: boolean;
  onDelete: (e: React.MouseEvent<HTMLButtonElement>, libraryId: string) => void;
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



export const LibraryCard: React.FC<LibraryCardProps> = ({
  library,
  onScan,
  onView,
  onPlay,
  isScanning: isScanningProp = false,
  onDelete,
}) => {
  const { getSessionForLibrary } = useScanSessionContext();
  const session = getSessionForLibrary(library.id);
  const { progress: scanProgress } = useScanProgress(session?.sessionId);
  const [scanStatus, setScanStatus] = useState(library.scanStatus);
  const [analysisProgress, setAnalysisProgress] = useState(-1);

  // Calculate progress from scan progress event or library stats
  useEffect(() => {
    if (scanProgress?.overallProgress) {
      setAnalysisProgress(scanProgress.overallProgress / 100);
    }
    if (scanProgress?.data?.status) {
      setScanStatus(scanProgress.data.status as LibraryScanStatus);
    }
  }, [scanProgress?.overallProgress, library.totalTracks, library.analyzedTracks]);
  const analysisCompleted = scanProgress?.type === 'scan.complete';
  // Use real-time scan progress if available, otherwise calculate from tracks

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const isScanning = !analysisCompleted && (session?.status === 'SCANNING' || isScanningProp);
  const totalTracks = library.totalTracks;
  const handleDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete(e, library.id);
  }
  const handleScan = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    onScan(e, library.id);
  }
  const handlePlay = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    onPlay(library.id);
  }
  return (

    <Card className="hover:shadow-lg  cursor-pointer hover:scale-103 transition-all min-w-sm" onClick={() => onView(library.id)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-row">
            <CardTitle className="text-lg flex items-center gap-2">{library.name} <Badge variant="outline" className="text-sm">{totalTracks}</Badge></CardTitle>
          </div>
          {scanStatus === 'SCANNING' ? <>
            <Badge
              className={`text-xs ${getScanStatusColor(scanStatus as LibraryScanStatus)} `}
            >
              {scanStatus}
              <span>{Math.round(analysisProgress)}%</span>
              <Loader className="h-4 w-4 animate-spin" />
            </Badge>
          </> :
            <Button
              variant="ghost"
              size="iconSm"
              onClick={handleDelete}
            >
              <Trash className="h-6 w-6" />
            </Button>
          }
        </div>
        <CardDescription className="text-sm text-muted-foreground max-w-full truncate">
          Folder: {library.rootPath}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">


        {/* Last Scan Info */}
        <div className="text-sm text-muted-foreground">
          <div>Last Scan: {formatDate(library.lastScanAt)}</div>
          {library.lastIncrementalScanAt && (
            <div>
              Last Incremental: {formatDate(library.lastIncrementalScanAt)}
            </div>
          )}
        </div>


        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2 w-full">

          <Button
            variant="outline"
            className="w-full"
            size="sm"
            onClick={handleScan}
            disabled={
              scanStatus === 'SCANNING' ||
              scanStatus === 'ANALYZING' ||
              isScanning
            }
          >
            <BarChart3 className="h-4 w-4 " />
            {isScanning ? 'Scanning...' : 'Scan'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handlePlay}
          >
            <Play className="h-4 w-4" /> Play
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
