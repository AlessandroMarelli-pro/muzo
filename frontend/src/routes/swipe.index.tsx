import { SwipePage } from '@/components/swipe/swipe-page';
import { fetchRandomTrackWithStats } from '@/services/api-hooks';
import { createFileRoute } from '@tanstack/react-router';

function SwipeRoute() {
  return <SwipePage key={'swipe-page'} />;
}

export const Route = createFileRoute('/swipe/')({
  component: SwipeRoute,
  loader: async () => {
    const trackData = await fetchRandomTrackWithStats();
    return { trackData, isLoading: false };
  },
});
