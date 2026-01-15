import { TrackRecommendation } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  useAddTrackToPlaylist,
  usePlaylistRecommendations,
} from '@/services/playlist-hooks';
import { Music, Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import {
  TrackRecommendationsCard,
  TrackRecommendationsCardSkeleton,
} from './track-recommendations-card';

interface TrackRecommendationsProps {
  playlistId: string;
  onTrackAdded: (trackId?: string) => void;
}

export const TrackRecommandationsComponent = ({
  recommendations,
  onAddTrack,
  isLoading,
}: {
  recommendations: TrackRecommendation[];
  onAddTrack?: (trackId: string) => void;
  isLoading: boolean;
}) => {
  return (
    <Card className="py-0">
      <CardContent className="p-0">
        <div className="divide-y">
          {!isLoading
            ? recommendations.map((recommendation) => (
                <TrackRecommendationsCard
                  recommendation={recommendation}
                  onAddTrack={onAddTrack}
                />
              ))
            : Array.from({ length: 5 }).map((_, i) => (
                <TrackRecommendationsCardSkeleton
                  key={`recommendations-skeleton-${i}`}
                />
              ))}
        </div>
      </CardContent>
    </Card>
  );
};

export function TrackRecommendations({
  playlistId,
  onTrackAdded,
}: TrackRecommendationsProps) {
  const {
    data: recommendations = [],
    refetch,
    isLoading: loading,
    error,
  } = usePlaylistRecommendations(playlistId, 20);

  const addTrackMutation = useAddTrackToPlaylist('default');

  useEffect(() => {
    refetch();
  }, [playlistId]);

  const handleAddTrack = async (trackId: string) => {
    try {
      await addTrackMutation.mutateAsync({ playlistId, input: { trackId } });
      onTrackAdded(trackId);

      // Remove the added track from recommendations
      refetch();
    } catch (error) {
      console.error('Failed to add track:', error);
    } finally {
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Recommendations
          </CardTitle>
          <CardDescription>
            Finding tracks similar to your playlist...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 border rounded-lg animate-pulse"
              >
                <div className="h-12 w-12 bg-gray-200 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error?.message}</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card className="py-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Recommendations
          </CardTitle>
          <CardDescription>
            No recommendations available for this playlist
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Music className="h-12 w-12 mx-auto mb-4" />
            <p>
              Add more tracks to your playlist to get better recommendations
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TrackRecommandationsComponent
      recommendations={recommendations}
      onAddTrack={handleAddTrack}
      isLoading={loading}
    />
  );
}
