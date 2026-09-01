import { PlaylistDetail } from '@/components/playlist/playlist-detail';
import { RouteError, RouteNotFound } from '@/components/route-error';
import { fetchPlaylist, fetchPlaylistRecommendations } from '@/services/playlist-hooks';
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router';

function PlaylistDetailPage() {
  const { playlistId } = Route.useParams();
  const navigate = useNavigate();

  const handleBackToPlaylists = () => {
    navigate({ to: '/playlists' });
  };

  return <PlaylistDetail id={playlistId} onBack={handleBackToPlaylists} />;
}

const loader = async ({ params }: { params: { playlistId: string } }) => {
  const { playlistId } = params;
  if (!playlistId) {
    throw notFound();
  }

  const [playlist, recommendations] = await Promise.all([
    fetchPlaylist(playlistId).catch(() => null),
    fetchPlaylistRecommendations(playlistId, 20).catch(() => []),
  ]);

  if (!playlist) {
    throw notFound();
  }

  return { playlist, recommendations };
};

export const Route = createFileRoute('/playlists/$playlistId')({
  component: PlaylistDetailPage,
  loader,
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
