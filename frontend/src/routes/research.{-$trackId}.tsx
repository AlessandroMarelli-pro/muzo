import { Research } from '@/components/research/research';
import { fetchRandomTrack, fetchTrackRecommendations } from '@/services/api-hooks';
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
  // Track both trackId (from params) and boost (from search) in loaderDeps
  loaderDeps: ({ search: { boost } }) => ({
    boost,
  }),
  loader: async ({ params, deps, }) => {
    const { trackId } = params;
    const criteria = deps.boost || undefined;

    // Only fetch randomTrack if trackId changed (when cause is 'enter' or trackId in deps changed)
    // If cause is 'stay', it means only search params changed, so we can skip fetching the track
    let randomTrack = await fetchRandomTrack(trackId);

    // Always fetch recommendations with current boost criteria
    const trackRecommendations = await fetchTrackRecommendations(
      randomTrack.id,
      criteria
    );

    return { randomTrack, trackRecommendations, isLoading: false };
  },
});