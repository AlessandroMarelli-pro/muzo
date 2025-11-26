import type { MusicLibrary, MusicTrack } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Lightbulb,
  Music,
  RefreshCw,
  Star,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import React from 'react';
import { NoData } from '../no-data';

interface LibraryInsightsProps {
  library: MusicLibrary;
  tracks: MusicTrack[];
  isLoading?: boolean;
  onRefreshInsights?: () => void;
}

interface InsightCardProps {
  type: 'success' | 'warning' | 'info' | 'tip';
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon: React.ReactNode;
}

const InsightCard: React.FC<InsightCardProps> = ({
  type,
  title,
  description,
  action,
  icon,
}) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'info':
        return 'border-blue-200 bg-blue-50';
      case 'tip':
        return 'border-purple-200 bg-purple-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getIconStyles = () => {
    switch (type) {
      case 'success':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'info':
        return 'text-blue-600';
      case 'tip':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Card className={`${getTypeStyles()} hover:shadow-md transition-shadow`}>
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          <div className={`p-2 rounded-lg ${getIconStyles()}`}>{icon}</div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-700 mb-4">{description}</p>
            {action && (
              <Button size="sm" variant="outline" onClick={action.onClick}>
                {action.label}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const generateInsights = (library: MusicLibrary, tracks: MusicTrack[]) => {
  const insights: InsightCardProps[] = [];

  const totalTracks = tracks.length;
  const analyzedTracks = tracks.filter(
    (t) => t.analysisStatus === 'COMPLETED',
  ).length;
  const pendingTracks = tracks.filter(
    (t) => t.analysisStatus === 'PENDING',
  ).length;
  const failedTracks = tracks.filter(
    (t) => t.analysisStatus === 'FAILED',
  ).length;

  const avgConfidence =
    tracks
      .filter((track) => track.aiConfidence)
      .reduce((sum, track) => sum + (track.aiConfidence || 0), 0) /
      tracks.filter((track) => track.aiConfidence).length || 0;

  const totalPlayCount = tracks.reduce(
    (sum, track) => sum + track.listeningCount,
    0,
  );
  const avgPlayCount = totalPlayCount / totalTracks;

  // Analysis completion insight
  if (analyzedTracks === totalTracks && totalTracks > 0) {
    insights.push({
      type: 'success',
      title: 'Analysis Complete!',
      description: `All ${totalTracks} tracks have been successfully analyzed. Your library is fully organized and ready for AI-powered features.`,
      icon: <CheckCircle className="h-5 w-5" />,
    });
  } else if (pendingTracks > 0) {
    insights.push({
      type: 'warning',
      title: 'Analysis In Progress',
      description: `${pendingTracks} tracks are still pending analysis. Consider running a batch analysis to complete the process.`,
      action: {
        label: 'Start Analysis',
        onClick: () => console.log('Start analysis'),
      },
      icon: <Clock className="h-5 w-5" />,
    });
  }

  // Failed analysis insight
  if (failedTracks > 0) {
    insights.push({
      type: 'warning',
      title: 'Analysis Issues Detected',
      description: `${failedTracks} tracks failed analysis. These may need manual review or different processing settings.`,
      action: {
        label: 'Review Failed',
        onClick: () => console.log('Review failed tracks'),
      },
      icon: <AlertTriangle className="h-5 w-5" />,
    });
  }

  // AI confidence insight
  if (avgConfidence > 0.8) {
    insights.push({
      type: 'success',
      title: 'High AI Confidence',
      description: `Your library has an average AI confidence of ${Math.round(
        avgConfidence * 100,
      )}%. The AI is very confident in its analysis results.`,
      icon: <Target className="h-5 w-5" />,
    });
  } else if (avgConfidence > 0.5) {
    insights.push({
      type: 'info',
      title: 'Moderate AI Confidence',
      description: `Average AI confidence is ${Math.round(
        avgConfidence * 100,
      )}%. Consider reviewing low-confidence tracks for better accuracy.`,
      icon: <Target className="h-5 w-5" />,
    });
  }

  // Listening patterns insight
  if (avgPlayCount > 10) {
    insights.push({
      type: 'tip',
      title: 'Active Listening Library',
      description: `Your tracks average ${Math.round(
        avgPlayCount,
      )} plays each. This suggests a well-used and curated collection.`,
      icon: <TrendingUp className="h-5 w-5" />,
    });
  } else if (avgPlayCount < 2) {
    insights.push({
      type: 'tip',
      title: 'Discovery Opportunity',
      description: `Your tracks average ${Math.round(
        avgPlayCount,
      )} plays each. Consider exploring your library more or creating playlists for discovery.`,
      action: {
        label: 'Create Playlist',
        onClick: () => console.log('Create playlist'),
      },
      icon: <Music className="h-5 w-5" />,
    });
  }

  // Genre diversity insight
  const genres = new Set(
    tracks
      .map((t) => t.userGenre || t.aiGenre || t.originalGenre)
      .filter(Boolean),
  );
  if (genres.size > 10) {
    insights.push({
      type: 'success',
      title: 'Diverse Music Taste',
      description: `Your library spans ${genres.size} different genres, showing excellent musical diversity.`,
      icon: <Star className="h-5 w-5" />,
    });
  } else if (genres.size < 3) {
    insights.push({
      type: 'tip',
      title: 'Genre Focus',
      description: `Your library focuses on ${genres.size} main genres. Consider exploring new musical styles to expand your collection.`,
      icon: <Music className="h-5 w-5" />,
    });
  }

  // Library size insight
  if (totalTracks > 1000) {
    insights.push({
      type: 'success',
      title: 'Large Collection',
      description: `With ${totalTracks} tracks, you have a substantial music library. Consider using advanced organization features.`,
      icon: <Users className="h-5 w-5" />,
    });
  } else if (totalTracks < 50) {
    insights.push({
      type: 'tip',
      title: 'Growing Collection',
      description: `You have ${totalTracks} tracks. As your library grows, AI organization will become even more valuable.`,
      icon: <TrendingUp className="h-5 w-5" />,
    });
  }

  // Format optimization insight
  const formats = tracks.reduce((acc, track) => {
    acc[track.format] = (acc[track.format] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hasLowQualityFormats = Object.keys(formats).some(
    (format) => ['MP3'].includes(format) && formats[format] / totalTracks > 0.8,
  );

  if (hasLowQualityFormats) {
    insights.push({
      type: 'info',
      title: 'Audio Quality Opportunity',
      description:
        'Most of your tracks are in compressed formats. Consider upgrading to lossless formats for better quality.',
      icon: <Zap className="h-5 w-5" />,
    });
  }

  return insights;
};

export const LibraryInsights: React.FC<LibraryInsightsProps> = ({
  library,
  tracks,
  isLoading = false,
  onRefreshInsights,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Library Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const insights = generateInsights(library, tracks);

  if (insights.length === 0) {
    return (
      <NoData
        Icon={Lightbulb}
        title="No Insights Available"
        subtitle="Add more tracks to your library to get personalized insights and recommendations."
        buttonAction={() => console.log('Add tracks')}
        buttonLabel="Add Tracks"
        ButtonIcon={Music}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Library Insights</h2>
          <p className="text-muted-foreground">
            AI-powered recommendations and analysis for your music library
          </p>
        </div>
        {onRefreshInsights && (
          <Button variant="outline" onClick={onRefreshInsights}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Insights
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((insight, index) => (
          <InsightCard
            key={index}
            type={insight.type}
            title={insight.title}
            description={insight.description}
            action={insight.action}
            icon={insight.icon}
          />
        ))}
      </div>

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Quick Stats
          </CardTitle>
          <CardDescription>Key metrics for {library.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {tracks.length}
              </div>
              <div className="text-sm text-muted-foreground">Total Tracks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {tracks.filter((t) => t.analysisStatus === 'COMPLETED').length}
              </div>
              <div className="text-sm text-muted-foreground">Analyzed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {
                  new Set(
                    tracks
                      .map((t) => t.userGenre || t.aiGenre || t.originalGenre)
                      .filter(Boolean),
                  ).size
                }
              </div>
              <div className="text-sm text-muted-foreground">Genres</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(
                  tracks.reduce((sum, t) => sum + t.listeningCount, 0) /
                    tracks.length || 0,
                )}
              </div>
              <div className="text-sm text-muted-foreground">Avg Plays</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
