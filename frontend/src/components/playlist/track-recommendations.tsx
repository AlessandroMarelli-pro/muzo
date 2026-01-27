import { TrackRecommendation } from '@/__generated__/types';
import {
  Card,
  CardContent
} from '@/components/ui/card';
import {
  useAddTrackToPlaylist
} from '@/services/playlist-hooks';
import { useRouter } from '@tanstack/react-router';
import {
  TrackRecommendationsCard,
  TrackRecommendationsCardSkeleton,
} from './track-recommendations-card';

interface TrackRecommendationsProps {
  playlistId: string;
  onTrackAdded: (trackId?: string) => void;
  recommendations: TrackRecommendation[];
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
  recommendations,
}: TrackRecommendationsProps) {

  const addTrackMutation = useAddTrackToPlaylist('default');
  const router = useRouter();
  const refetchRecommendations = () => {
    router.invalidate();
  }
  const handleAddTrack = async (trackId: string) => {
    try {
      await addTrackMutation.mutateAsync({ playlistId, input: { trackId } });
      onTrackAdded(trackId);

      // Remove the added track from recommendations
      refetchRecommendations();
    } catch (error) {
      console.error('Failed to add track:', error);
    } finally {
    }
  };




  return (
    <TrackRecommandationsComponent
      recommendations={recommendations}
      onAddTrack={handleAddTrack}
      isLoading={false}
    />
  );
}
