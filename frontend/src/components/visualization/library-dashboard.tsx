import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useQueue } from '@/contexts/audio-player-context';
import { useLibrary, useTracks } from '@/services/api-hooks';
import {
  BarChart3,
  Download,
  Filter,
  Lightbulb,
  RefreshCw,
  Settings,
  Share2,
  TrendingUp,
} from 'lucide-react';
import React, { useState } from 'react';
import MusicCard from '../track/music-card';
import { LibraryChart } from './library-chart';
import { LibraryInsights } from './library-insights';
import { LibraryStats } from './library-stats';

interface LibraryDashboardProps {
  libraryId: string;
  onRefresh?: () => void;
  onExportData?: () => void;
  onShareLibrary?: () => void;
}

type DashboardView = 'overview' | 'analytics' | 'insights';

export const LibraryDashboard: React.FC<LibraryDashboardProps> = ({
  libraryId,
  onRefresh,
  onExportData,
  onShareLibrary,
}) => {
  const { data: tracks = [], isLoading } = useTracks({ libraryId });
  const { data: library = {}, isLoading: isLibraryLoading } =
    useLibrary(libraryId);

  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { setQueue } = useQueue();
  const handleSetQueue = () => {
    setQueue(tracks);
  };
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setIsRefreshing(false);
    }
  };

  const views = [
    {
      id: 'overview' as DashboardView,
      label: 'Overview',
      icon: <BarChart3 className="h-4 w-4" />,
      description: 'Key statistics and metrics',
    },
    {
      id: 'analytics' as DashboardView,
      label: 'Analytics',
      icon: <TrendingUp className="h-4 w-4" />,
      description: 'Charts and visualizations',
    },
    {
      id: 'insights' as DashboardView,
      label: 'Insights',
      icon: <Lightbulb className="h-4 w-4" />,
      description: 'AI recommendations',
    },
  ];

  const renderActiveView = () => {
    switch (activeView) {
      case 'overview':
        return (
          <LibraryStats
            library={library}
            tracks={tracks}
            isLoading={isLoading}
          />
        );
      case 'analytics':
        return <LibraryChart tracks={tracks} isLoading={isLoading} />;
      case 'insights':
        return (
          <LibraryInsights
            library={library}
            tracks={tracks}
            isLoading={isLoading}
            onRefreshInsights={handleRefresh}
          />
        );
      default:
        return null;
    }
  };

  if (isLoading || isLibraryLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Library Dashboard</h1>
            <p className="text-muted-foreground">Loading library data...</p>
          </div>
        </div>
        <div className="h-96 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{library?.name} Dashboard</h1>
          <p className="text-muted-foreground">
            {tracks.length} tracks • {library?.scanStatus} • Last updated{' '}
            {new Date().toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-sm">
            {library?.scanStatus}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Tracks
                </p>
                <p className="text-2xl font-bold">
                  {tracks.length.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Analyzed
                </p>
                <p className="text-2xl font-bold">
                  {
                    tracks?.filter((t) => t.analysisStatus === 'COMPLETED')
                      .length
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Lightbulb className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Genres
                </p>
                <p className="text-2xl font-bold">
                  {
                    new Set(
                      tracks
                        .map((t) => t.userGenre || t.aiGenre || t.originalGenre)
                        .filter(Boolean),
                    ).size
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Settings className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Formats
                </p>
                <p className="text-2xl font-bold">
                  {new Set(tracks?.map((t) => t.format)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Library Analysis</CardTitle>
              <CardDescription>
                Explore different views of your music library data
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              {onExportData && (
                <Button variant="outline" size="sm" onClick={onExportData}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
              {onShareLibrary && (
                <Button variant="outline" size="sm" onClick={onShareLibrary}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
            {views.map((view) => (
              <Button
                key={view.id}
                variant={activeView === view.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveView(view.id)}
                className="flex items-center space-x-2"
              >
                {view.icon}
                <span>{view.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active View Content */}
      <div className="min-h-[600px]">{renderActiveView()}</div>

      <Card>
        <CardContent className="p-6">
          <div
            className={'flex flex-wrap  justify-center gap-3  overflow-y-auto'}
          >
            {tracks?.map((track) => (
              <MusicCard
                key={track.id}
                track={track}
                setQueue={handleSetQueue}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Last updated: {new Date().toLocaleString()}
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter Data
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${
                    isRefreshing ? 'animate-spin' : ''
                  }`}
                />
                Refresh All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
