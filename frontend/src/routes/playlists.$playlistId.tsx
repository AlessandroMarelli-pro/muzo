import { PlaylistDetail } from '@/components/playlist/playlist-detail';
import { RouteError, RouteNotFound } from '@/components/route-error';
import {
  playlistQueryOptions,
  playlistRecommendationsQueryOptions,
} from '@/services/playlist-hooks';
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router';

function PlaylistDetailPage() {
  const { playlistId } = Route.useParams();
  const navigate = useNavigate();

  const handleBackToPlaylists = () => {
    navigate({ to: '/playlists' });
  };

  return <PlaylistDetail id={playlistId} onBack={handleBackToPlaylists} />;
}

export const Route = createFileRoute('/playlists/$playlistId')({
  component: PlaylistDetailPage,
  loader: async ({ params, context }) => {
    const { playlistId } = params;
    if (!playlistId) {
      throw notFound();
    }

    const playlist = await context.queryClient
      .ensureQueryData(playlistQueryOptions(playlistId))
      .catch(() => null);

    if (!playlist) {
      throw notFound();
    }

    // Recommendations are expensive (library-wide similarity search). Warm the
    // cache without blocking the loader so navigating in — and every
    // router.invalidate() from a track add/remove — stays fast. The
    // Recommendations tab reads this query and shows its own loading state.
    void context.queryClient.prefetchQuery(playlistRecommendationsQueryOptions(playlistId, 50));

    return { playlist };
  },
  errorComponent: ({ error }) => (
    <RouteError
      error={error}
      title="Couldn't load this playlist"
      message="Something went wrong loading this playlist. Try again, or head back to your playlists."
      backTo="/playlists"
      backLabel="Back to playlists"
    />
  ),
  notFoundComponent: () => (
    <RouteNotFound
      title="Playlist not found"
      message="This playlist may have been deleted, or the link is out of date."
      backTo="/playlists"
      backLabel="Back to playlists"
    />
  ),
});
