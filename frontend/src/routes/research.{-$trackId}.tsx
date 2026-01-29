import { Research } from '@/components/research/research';
import {
  fetchRandomTrack,
  randomTrackQueryOptions,
  trackRecommendationsQueryOptions,
} from '@/services/api-hooks';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

function ResearchTrackDetailPage() {
  return <Research />;
}

const researchSearchSchema = z.object({
  boost: z.string().optional(),
});

export const Route = createFileRoute('/research/{-$trackId}')({
  component: ResearchTrackDetailPage,
  validateSearch: researchSearchSchema,
  staleTime: 10_000,
  // Redirect to /research/<trackId> when trackId is undefined
  beforeLoad: async ({ params, location }) => {
    const { trackId } = params;
    if (!trackId) {
      // Fetch a random track and redirect to /research/<trackId>
      const randomTrack = await fetchRandomTrack();
      throw redirect({
        to: '/research/{-$trackId}',
        params: { trackId: randomTrack.id },
        search: location.search, // Preserve search params (boost)
      });
    }
  },
  loaderDeps: ({ search }) => ({
    boost: search.boost,
  }),
  loader: async ({ params, deps, context }) => {
    const { trackId } = params;
    const criteria = deps.boost ?? undefined;

    const randomTrack = await context.queryClient.ensureQueryData(
      randomTrackQueryOptions(trackId),
    );
    const trackRecommendations = await context.queryClient.ensureQueryData(
      trackRecommendationsQueryOptions(randomTrack.id, criteria),
    );

    return { randomTrack, trackRecommendations, isLoading: false };
  },
});