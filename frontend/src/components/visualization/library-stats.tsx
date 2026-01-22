import type { MusicLibrary, MusicTrack } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  TrendingUp,
  Users,
} from 'lucide-react';
import React from 'react';

interface LibraryStatsProps {
  library: MusicLibrary;
  tracks: MusicTrack[];
  isLoading?: boolean;
}

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'default' | 'success' | 'warning' | 'danger';
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon,
  trend,
  color = 'default',
}) => {
  const getColorClasses = () => {
    switch (color) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'danger':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${getColorClasses()}`}>{icon}</div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {title}
              </p>
              <p className="text-2xl font-bold">{value}</p>
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          {trend && (
            <div
              className={`flex items-center space-x-1 text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'
                }`}
            >
              <TrendingUp
                className={`h-4 w-4 ${trend.isPositive ? '' : 'rotate-180'}`}
              />
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

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

const getAnalysisStatusCounts = (tracks: MusicTrack[]) => {
  return tracks.reduce((counts, track) => {
    const status = track.analysisStatus as AnalysisStatus;
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {} as Record<AnalysisStatus, number>);
};

const getGenreDistribution = (tracks: MusicTrack[]) => {
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
    .slice(0, 10); // Top 10 genres
};

const getFormatDistribution = (tracks: MusicTrack[]) => {
  const formatCounts: Record<string, number> = {};

  tracks.forEach((track) => {
    formatCounts[track.format] = (formatCounts[track.format] || 0) + 1;
  });

  return Object.entries(formatCounts)
    .map(([format, count]) => ({ format, count }))
    .sort((a, b) => b.count - a.count);
};

const getYearDistribution = (tracks: MusicTrack[]) => {
  const yearCounts: Record<number, number> = {};

  tracks.forEach((track) => {
    const year = track.originalYear;
    if (year && year >= 1900 && year <= new Date().getFullYear()) {
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    }
  });

  return Object.entries(yearCounts)
    .map(([year, count]) => ({ year: parseInt(year), count }))
    .sort((a, b) => a.year - b.year);
};

export const LibraryStats: React.FC<LibraryStatsProps> = ({
  library,
  tracks = [],
  isLoading = false,
}) => {
  // Subscribe to real-time scan progress updates
  const { getSessionForLibrary } = useScanSessionContext();
  const session = getSessionForLibrary(library.id);
  const { progress: scanProgress } = useScanProgress(session?.sessionId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Library Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-24 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const totalTracks = tracks.length;
  const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0);
  const totalSize = tracks.reduce((sum, track) => sum + track.fileSize, 0);
  const totalPlayCount = tracks.reduce(
    (sum, track) => sum + track.listeningCount,
    0,
  );

  const analysisStatusCounts = getAnalysisStatusCounts(tracks);
  const genreDistribution = getGenreDistribution(tracks);
  const formatDistribution = getFormatDistribution(tracks);
  const yearDistribution = getYearDistribution(tracks);

  // Use real-time scan progress if available, otherwise calculate from tracks
  const analysisProgress = scanProgress?.overallProgress
    ? scanProgress.overallProgress
    : totalTracks > 0
      ? ((analysisStatusCounts.COMPLETED || 0) / totalTracks) * 100
      : 0;

  // Extract progress details from scan event
  const processedFiles = scanProgress?.data?.completedTracks || 0;
  const totalFiles = scanProgress?.data?.totalTracks || totalTracks;
  const remainingFiles = totalFiles - processedFiles;
  const scanStatus = scanProgress?.data?.status || library.scanStatus;

  const avgConfidence =
    tracks
      .filter((track) => track.aiConfidence)
      .reduce((sum, track) => sum + (track.aiConfidence || 0), 0) /
    tracks.filter((track) => track.aiConfidence).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">Library Statistics</h2>
            {scanStatus === 'SCANNING' && (
              <div className="flex items-center gap-1 text-blue-600">
                <Loader className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">Scanning...</span>
              </div>
            )}
          </div>
          <p className="text-muted-foreground">
            Overview of {library?.name} - {totalTracks} tracks
            {scanProgress && (
              <span className="ml-2 text-blue-600">
                ({processedFiles}/{totalFiles} processed)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            Last updated: {new Date().toLocaleDateString()}
          </Badge>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Tracks"
          value={totalTracks.toLocaleString()}
          description="Audio files"
          icon={<Music className="h-5 w-5" />}
          color="default"
        />

        <StatCard
          title="Total Duration"
          value={formatDuration(totalDuration)}
          description="Play time"
          icon={<Clock className="h-5 w-5" />}
          color="default"
        />

        <StatCard
          title="Total Size"
          value={formatFileSize(totalSize)}
          description="Storage used"
          icon={<HardDrive className="h-5 w-5" />}
          color="default"
        />

        <StatCard
          title="Total Plays"
          value={totalPlayCount.toLocaleString()}
          description="Listen count"
          icon={<Users className="h-5 w-5" />}
          color="success"
        />
      </div>

      {/* Analysis Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Analysis Progress"
          value={`${Math.round(analysisProgress)}%`}
          description={
            scanProgress
              ? `${processedFiles}/${totalFiles} processed`
              : `${analysisStatusCounts.COMPLETED || 0} completed`
          }
          icon={<CheckCircle className="h-5 w-5" />}
          color={scanStatus === 'SCANNING' ? 'warning' : 'success'}
        />

        <StatCard
          title="Pending Analysis"
          value={scanProgress ? remainingFiles : analysisStatusCounts.PENDING || 0}
          description={scanProgress ? 'Remaining files' : 'Awaiting processing'}
          icon={<Clock className="h-5 w-5" />}
          color="warning"
        />

        <StatCard
          title="Processing"
          value={analysisStatusCounts.PROCESSING || 0}
          description="Currently analyzing"
          icon={<Loader className="h-5 w-5" />}
          color="warning"
        />

        <StatCard
          title="Failed Analysis"
          value={analysisStatusCounts.FAILED || 0}
          description="Need attention"
          icon={<AlertCircle className="h-5 w-5" />}
          color="danger"
        />
      </div>

      {/* AI Analysis Quality */}
      {avgConfidence > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            title="Average AI Confidence"
            value={`${Math.round(avgConfidence * 100)}%`}
            description="Analysis quality"
            icon={<BarChart3 className="h-5 w-5" />}
            color="success"
          />

          <StatCard
            title="Genres Identified"
            value={genreDistribution.length}
            description="Unique genres found"
            icon={<Disc className="h-5 w-5" />}
            color="default"
          />
        </div>
      )}

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Genre Distribution */}
        {genreDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Disc className="h-5 w-5 mr-2" />
                Genre Distribution
              </CardTitle>
              <CardDescription>Top genres in your library</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {genreDistribution.slice(0, 5).map(({ genre, count }) => (
                  <div
                    key={genre}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm font-medium">{genre}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(count / genreDistribution[0].count) * 100
                              }%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Format Distribution */}
        {formatDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <HardDrive className="h-5 w-5 mr-2" />
                Format Distribution
              </CardTitle>
              <CardDescription>Audio formats in your library</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {formatDistribution.map(({ format, count }) => (
                  <div
                    key={format}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm font-medium">{format}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{
                            width: `${(count / formatDistribution[0].count) * 100
                              }%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Year Distribution */}
      {yearDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Year Distribution
            </CardTitle>
            <CardDescription>
              Music release years in your library
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {yearDistribution.slice(0, 10).map(({ year, count }) => (
                <div key={year} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{year}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{
                          width: `${(count / yearDistribution[0].count) * 100
                            }%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-8 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
