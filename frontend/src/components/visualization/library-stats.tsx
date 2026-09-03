import type { Library, Track } from '@/__generated__/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useScanSessionContext } from '@/contexts/scan-session.context';
import { AnalysisStatus } from '@/services/api-hooks';
import { useScanProgress } from '@/services/sse-service';
import {
  AlertCircle,
  BarChart3,
  CheckCircle,
  Clock,
  Disc,
  HardDrive,
  Loader,
  Music,
  Users,
} from 'lucide-react';
import React from 'react';
import { StatTile } from './stat-tile';

interface LibraryStatsProps {
  library: Library;
  tracks: Track[];
  isLoading?: boolean;
}

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

const formatFileSize = (bytes: number) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
};

const getAnalysisStatusCounts = (tracks: Track[]) => {
  return tracks.reduce(
    (counts, track) => {
      const status = track.analysisStatus as AnalysisStatus;
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    },
    {} as Record<AnalysisStatus, number>,
  );
};

const getGenreDistribution = (tracks: Track[]) => {
  const genreCounts: Record<string, number> = {};

  tracks.forEach((track) => {
    if (track.genres && track.genres.length > 0) {
      track.genres.forEach((genre) => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });
    } else {
      genreCounts['Unknown'] = (genreCounts['Unknown'] || 0) + 1;
    }
  });

  return Object.entries(genreCounts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
};

const getFormatDistribution = (tracks: Track[]) => {
  const formatCounts: Record<string, number> = {};

  tracks
    .filter((track) => track.format)
    .forEach((track) => {
      formatCounts[track.format!] = (formatCounts[track.format!] || 0) + 1;
    });

  return Object.entries(formatCounts)
    .map(([format, count]) => ({ format, count }))
    .sort((a, b) => b.count - a.count);
};

const getYearDistribution = (tracks: Track[]) => {
  const yearCounts: Record<number, number> = {};

  tracks.forEach((track) => {
    const date = track.date ? new Date(track.date) : undefined;
    const year = date?.getFullYear();
    if (year && year >= 1900 && year <= new Date().getFullYear()) {
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    }
  });

  return Object.entries(yearCounts)
    .map(([year, count]) => ({ year: parseInt(year), count }))
    .sort((a, b) => a.year - b.year);
};

interface DistributionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  barClassName: string;
  rows: { label: string; count: number }[];
  max: number;
}

const DistributionCard: React.FC<DistributionCardProps> = ({
  title,
  description,
  icon,
  barClassName,
  rows,
  max,
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        {icon}
        {title}
      </CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {rows.map(({ label, count }) => (
          <div key={label} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3">
            <span className="truncate text-sm font-medium">{label}</span>
            <div className="h-1.5 rounded-full bg-muted">
              <div
                className={`h-1.5 rounded-full ${barClassName}`}
                style={{ width: `${max > 0 ? (count / max) * 100 : 0}%` }}
              />
            </div>
            <span className="text-right text-sm text-muted-foreground tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export const LibraryStats: React.FC<LibraryStatsProps> = ({
  library,
  tracks = [],
  isLoading = false,
}) => {
  const { getSessionForLibrary } = useScanSessionContext();
  const session = getSessionForLibrary(library.id);
  const { progress: scanProgress } = useScanProgress(session?.sessionId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  const totalTracks = tracks.length;
  const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0);
  const totalSize = tracks.reduce((sum, track) => sum + track.fileSize, 0);
  const totalPlayCount = tracks.reduce((sum, track) => sum + track.listeningCount, 0);

  const analysisStatusCounts = getAnalysisStatusCounts(tracks);
  const genreDistribution = getGenreDistribution(tracks);
  const formatDistribution = getFormatDistribution(tracks);
  const yearDistribution = getYearDistribution(tracks);

  // overallProgress is a 0-100 percentage from the backend boundary onward -- see
  // ScanStateEvent.overallProgress in ScanProgress.types.ts. Using `?? undefined` rather than
  // `||`/ternary-on-truthiness means a legitimate 0 (scan just started) doesn't fall through
  // to the DB-derived fallback.
  const analysisProgress =
    scanProgress?.overallProgress ??
    (totalTracks > 0 ? ((analysisStatusCounts.COMPLETED || 0) / totalTracks) * 100 : 0);

  const processedFiles = scanProgress?.data?.completedTracks || 0;
  const totalFiles = scanProgress?.data?.totalTracks || totalTracks;
  const remainingFiles = totalFiles - processedFiles;
  const scanStatus = scanProgress?.data?.status || library.scanStatus;

  return (
    <div className="space-y-6">
      {scanStatus === 'SCANNING' && (
        <div className="flex w-fit items-center gap-1.5 rounded-full border border-info-border bg-info-surface px-2.5 py-1 text-sm font-medium text-info-foreground">
          <Loader className="h-4 w-4 animate-spin" />
          Scanning… {processedFiles}/{totalFiles} processed
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total tracks"
          value={totalTracks.toLocaleString()}
          icon={<Music />}
          accent={1}
        />
        <StatTile
          label="Total duration"
          value={formatDuration(totalDuration)}
          icon={<Clock />}
          accent={2}
        />
        <StatTile
          label="Total size"
          value={formatFileSize(totalSize)}
          icon={<HardDrive />}
          accent={3}
        />
        <StatTile
          label="Total plays"
          value={totalPlayCount.toLocaleString()}
          icon={<Users />}
          accent={4}
        />
      </div>

      {/* Analysis Status */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Analysis progress"
          value={`${Math.round(analysisProgress)}%`}
          hint={
            scanProgress
              ? `${processedFiles}/${totalFiles} processed`
              : `${analysisStatusCounts.COMPLETED || 0} completed`
          }
          icon={<CheckCircle />}
          accent={1}
        />
        <StatTile
          label="Pending analysis"
          value={scanProgress ? remainingFiles : analysisStatusCounts.PENDING || 0}
          hint={scanProgress ? 'Remaining files' : 'Awaiting processing'}
          icon={<Clock />}
          accent={2}
        />
        <StatTile
          label="Processing"
          value={analysisStatusCounts.PROCESSING || 0}
          hint="Currently analyzing"
          icon={<Loader />}
          accent={3}
        />
        <StatTile
          label="Failed analysis"
          value={analysisStatusCounts.FAILED || 0}
          hint="Need attention"
          icon={<AlertCircle />}
          accent={5}
        />
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {genreDistribution.length > 0 && (
          <DistributionCard
            title="Genre distribution"
            description="Top genres in your library"
            icon={<Disc className="h-5 w-5" />}
            barClassName="bg-chart-1"
            rows={genreDistribution.slice(0, 5).map((g) => ({ label: g.genre, count: g.count }))}
            max={genreDistribution[0].count}
          />
        )}

        {formatDistribution.length > 0 && (
          <DistributionCard
            title="Format distribution"
            description="Audio formats in your library"
            icon={<HardDrive className="h-5 w-5" />}
            barClassName="bg-chart-2"
            rows={formatDistribution.map((f) => ({ label: f.format, count: f.count }))}
            max={formatDistribution[0].count}
          />
        )}
      </div>

      {yearDistribution.length > 0 && (
        <DistributionCard
          title="Year distribution"
          description="Music release years in your library"
          icon={<BarChart3 className="h-5 w-5" />}
          barClassName="bg-chart-3"
          rows={yearDistribution
            .slice(0, 10)
            .map((y) => ({ label: String(y.year), count: y.count }))}
          max={yearDistribution[0].count}
        />
      )}
    </div>
  );
};
