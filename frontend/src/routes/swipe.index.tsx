import { SwipePage } from '@/components/swipe/swipe-page';
import { useRandomTrackWithStats } from '@/services/api-hooks';
import { createFileRoute } from '@tanstack/react-router';

function SwipeRoute() {
  const {
    data: trackData,
    isLoading: isLoadingTrack,
  } = useRandomTrackWithStats();
  return <SwipePage key={'swipe-page'} trackData={trackData} isLoadingTrack={isLoadingTrack} />;
}

export const Route = createFileRoute('/swipe/')({
  component: SwipeRoute,

});
