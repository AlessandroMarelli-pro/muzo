import { TrackRecommendation } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  useAddTrackToPlaylist,
  usePlaylistRecommendations,
} from '@/services/playlist-hooks';
import { Sparkles } from 'lucide-react';
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
            ? recommendations.map((recommendation, index) => (
              <TrackRecommendationsCard
                recommendation={recommendation}
                onAddTrack={onAddTrack}
                index={index}
                recommendationsLength={recommendations.length}
              />
            ))
            : Array.from({ length: 10 }).map((_, i) => (
              <TrackRecommendationsCardSkeleton
                key={`recommendations-skeleton-${i}`}
                index={i}
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



  return (
    <TrackRecommandationsComponent
      recommendations={recommendations}
      onAddTrack={handleAddTrack}
      isLoading={loading || recommendations.length === 0}
    />
  );
}
