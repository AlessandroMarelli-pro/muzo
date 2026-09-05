import { Similar } from "@/components/similar/similar";
import {
  randomTrackQueryOptions,
  trackRecommendationsQueryOptions,
} from "@/services/api-hooks";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

function SimilarTrackDetailPage() {
  return <Similar />;
}

const similarSearchSchema = z.object({
  boost: z.string().optional(),
});

export const Route = createFileRoute("/similar/{-$trackId}")({
  component: SimilarTrackDetailPage,
  validateSearch: similarSearchSchema,
  staleTime: 10_000,

  loaderDeps: ({ search }) => ({
    boost: search.boost,
  }),
  loader: async ({ params, deps, context }) => {
    const { user } = context;
    const { trackId } = params;
    const randomTrackId = trackId || user?.randomTrackId;

    const boost = deps.boost ?? undefined;

    if (!randomTrackId) {
      return { randomTrack: undefined, trackRecommendations: [], isLoading: false };
    }

    const randomTrack = await context.queryClient.ensureQueryData(
      randomTrackQueryOptions(randomTrackId),
    );
    const trackRecommendations = await context.queryClient.ensureQueryData(
      trackRecommendationsQueryOptions(randomTrack.id, boost),
    );

    return { randomTrack, trackRecommendations, isLoading: false };
  },
});
