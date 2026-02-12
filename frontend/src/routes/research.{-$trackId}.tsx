import { Research } from '@/components/research/research';
import {
	randomTrackQueryOptions,
	trackRecommendationsQueryOptions,
} from '@/services/api-hooks';
import { createFileRoute } from '@tanstack/react-router';
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

	loaderDeps: ({ search }) => ({
		boost: search.boost,
	}),
	loader: async ({ params, deps, context }) => {
		const { user } = context;
		const { trackId } = params;
		const randomTrackId = trackId || user?.randomTrackId;
		console.log('randomTrackId', randomTrackId);

		const criteria = deps.boost ?? undefined;

		const randomTrack = await context.queryClient.ensureQueryData(
			randomTrackQueryOptions(randomTrackId)
		);
		const trackRecommendations = await context.queryClient.ensureQueryData(
			trackRecommendationsQueryOptions(randomTrack.id, criteria)
		);

		return { randomTrack, trackRecommendations, isLoading: false };
	},
});
