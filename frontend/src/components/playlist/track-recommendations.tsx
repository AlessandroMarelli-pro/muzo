import { TrackRecommendation } from '@/__generated__/types';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAddTrackToPlaylist, usePlaylistRecommendations } from '@/services/playlist-hooks';
import type { RecommendationSeedStrategy } from '@/services/recommendation-types';
import { useRouter } from '@tanstack/react-router';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  TrackRecommendationsCard,
  TrackRecommendationsCardSkeleton,
  TrackRecommendationsHeader,
} from './track-recommendations-card';

interface TrackRecommendationsProps {
  playlistId: string;
  onTrackAdded: (trackId: string, artist: string, title: string) => void;
  recommendations: TrackRecommendation[];
}

export const TrackRecommandationsComponent = ({
  recommendations,
  onAddTrack,
  isLoading,
  addedIds,
}: {
  recommendations: TrackRecommendation[];
  onAddTrack?: (trackId: string, artist: string, title: string) => void;
  isLoading: boolean;
  addedIds?: Set<string>;
}) => {
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="p-0">
        <TrackRecommendationsHeader />
        <div className="divide-y">
          {!isLoading
            ? recommendations.map((recommendation, index) => (
                <TrackRecommendationsCard
                  key={recommendation.track?.id ?? `recommendation-${index}`}
                  recommendation={recommendation}
                  onAddTrack={onAddTrack}
                  index={index}
                  recommendationsLength={recommendations.length}
                  added={
                    recommendation.track?.id
                      ? addedIds?.has(recommendation.track.id) ?? false
                      : false
                  }
                />
              ))
            : Array.from({ length: 10 }).map((_, i) => (
                <TrackRecommendationsCardSkeleton key={`recommendations-skeleton-${i}`} index={i} />
              ))}
        </div>
      </CardContent>
    </Card>
  );
};

export function TrackRecommendations({
  playlistId,
  onTrackAdded,
  recommendations: initialRecommendations,
}: TrackRecommendationsProps) {
  const addTrackMutation = useAddTrackToPlaylist('default');
  const router = useRouter();
  const [seedStrategy, setSeedStrategy] = useState<RecommendationSeedStrategy>('mean');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // The playlist route loader already fetched `mean` recommendations for the
  // initial render -- only issue a client-side fetch once the user actually
  // switches strategy, instead of refetching on mount.
  const {
    data: fetchedRecommendations,
    isLoading,
    refetch: refetchRecommendations,
  } = usePlaylistRecommendations(playlistId, 20, seedStrategy, undefined, {
    enabled: seedStrategy !== 'mean',
  });
  const recommendations = seedStrategy === 'mean' ? initialRecommendations : fetchedRecommendations;

  const handleAddTrack = async (trackId: string, artist: string, title: string) => {
    // Grey the row out immediately instead of letting it vanish on refetch.
    setAddedIds((prev) => new Set(prev).add(trackId));
    try {
      await addTrackMutation.mutateAsync({
        playlistId,
        input: { trackId },
        artist,
        title,
      });
      onTrackAdded(trackId, artist, title);

      if (seedStrategy === 'mean') {
        router.invalidate();
      } else {
        refetchRecommendations();
      }
    } catch (error) {
      console.error('Failed to add track:', error);
      toast.error('Could not add that track. Please try again.');
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          From your library — pencilled in
        </p>
        <ToggleGroup
          type="single"
          value={seedStrategy}
          onValueChange={(value) => {
            if (value) {
              setSeedStrategy(value as RecommendationSeedStrategy);
            }
          }}
          variant="outline"
        >
          <ToggleGroupItem value="mean" className="h-8 px-3 text-xs" aria-label="Cohesive matches">
            Cohesive
          </ToggleGroupItem>
          <ToggleGroupItem value="max" className="h-8 px-3 text-xs" aria-label="Eclectic matches">
            Eclectic
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <TrackRecommandationsComponent
        recommendations={recommendations ?? []}
        onAddTrack={handleAddTrack}
        isLoading={seedStrategy !== 'mean' && isLoading}
        addedIds={addedIds}
      />
    </div>
  );
}
