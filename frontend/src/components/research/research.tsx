import { SimpleMusicTrack } from '@/__generated__/types';
import { cn } from '@/lib/utils';
import { useTrackRecommendations } from '@/services/api-hooks';
import { Check, PlusCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TrackRecommandationsComponent } from '../playlist/track-recommendations';
import { DetailedTrackCard } from '../track/detailed-track-card';
import { Button } from '../ui/button';

const DashedButton = ({
  children,
  onClick,
  selected,
}: {
  children: React.ReactNode;
  onClick: () => void;
  selected: boolean;
}) => {
  return (
    <Button
      onClick={onClick}
      className={cn('border-dashed')}
      variant={selected ? 'default' : 'outline'}
      size="sm"
    >
      {selected ? (
        <Check className="w-4 h-4 " />
      ) : (
        <PlusCircle className="w-4 h-4" />
      )}
      {children}
    </Button>
  );
};

export function Research({
  track,
  refetch,
  isLoading,
}: {
  track?: SimpleMusicTrack;
  refetch: () => void;
  isLoading: boolean;
}) {
  const [selectedBoost, setSelectedBoost] = useState<string[]>([]);
  const {
    data: trackRecommendations,
    isLoading: isLoadingTrackRecommendations,
    refetch: refetchTrackRecommendations,
  } = useTrackRecommendations(track?.id, selectedBoost.join(','));

  useEffect(() => {
    if (selectedBoost) {
      refetchTrackRecommendations();
    }
  }, [selectedBoost]);

  const handleSelectedBoost = (key: string) => {
    console.log('selectedBoost', selectedBoost);
    if (selectedBoost?.some((k) => k === key)) {
      setSelectedBoost((prev) => prev?.filter((k) => k !== key));
    } else {
      setSelectedBoost((prev) => [...prev, key]);
    }
  };
  return (
    <div className="p-6 space-y-6 min-w-fit">
      <DetailedTrackCard track={track} refetch={refetch} isLoading={isLoading} />
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'audioSimilarity', label: 'Audio Similarity' },
          { key: 'genreSimilarity', label: 'Genre Similarity' },
          { key: 'metadataSimilarity', label: 'Metadata Similarity' },
          { key: 'userBehavior', label: 'User Behavior' },
          { key: 'audioFeatures', label: 'Audio Features' },
        ].map(({ key, label }) => (
          <DashedButton
            key={key}
            onClick={() => handleSelectedBoost(key)}
            selected={selectedBoost?.some((k) => k === key)}
          >
            {label}
          </DashedButton>
        ))}
      </div>
      <TrackRecommandationsComponent
        recommendations={trackRecommendations || []}
        isLoading={isLoadingTrackRecommendations || isLoading}
        onAddTrack={() => { }}
      />
    </div>
  );
}
