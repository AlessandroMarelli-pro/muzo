import { cn } from '@/lib/utils';
import { Route } from '@/routes/research.{-$trackId}';
import { fetchRandomTrack } from '@/services/api-hooks';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { Check, PlusCircle } from 'lucide-react';
import { useMemo } from 'react';
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

export function Research() {
  const router = useRouter();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const { randomTrack: track, isLoading, trackRecommendations } = Route.useLoaderData();
  const refetch = async () => {
    const randomTrack = await fetchRandomTrack();
    navigate({
      to: '/research/{-$trackId}',
      params: { trackId: randomTrack.id },
    });
  };
  // Parse boost from search params (comma-separated string)
  const selectedBoost = useMemo(() => {
    return search.boost ? search.boost.split(',').filter(Boolean) : [];
  }, [search.boost]);

  const handleSelectedBoost = (key: string) => {
    const currentBoost = selectedBoost;
    let newBoost: string[];

    if (currentBoost.some((k) => k === key)) {
      newBoost = currentBoost.filter((k) => k !== key);
    } else {
      newBoost = [...currentBoost, key];
    }

    // Update search params - this will trigger loaderDeps to change and refetch
    router.navigate({
      search: {
        boost: newBoost.length > 0 ? newBoost.join(',') : undefined,
      },
      replace: true,
    });
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
        isLoading={isLoading}
      />
    </div>
  );
}
