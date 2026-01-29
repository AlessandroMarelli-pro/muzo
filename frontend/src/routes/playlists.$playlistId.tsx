import { PlaylistDetail } from '@/components/playlist';
import { fetchPlaylist, fetchPlaylistRecommendations } from '@/services/playlist-hooks';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

function PlaylistDetailPage() {
  const { playlistId } = Route.useParams();
  const navigate = useNavigate();

  const handleBackToPlaylists = () => {
    navigate({ to: '/playlists' });
  };

  console.log('PlaylistDetailPage rendered with playlistId:', playlistId);

  if (!playlistId) {
    console.error('No playlistId provided');
    return <div>Error: No playlist ID provided</div>;
  }

  return <PlaylistDetail id={playlistId} onBack={handleBackToPlaylists} />;
}
const loader = async ({ params }: { params: { playlistId: string } }) => {
  const { playlistId } = params;
  const [playlist, recommendations] = await Promise.all([fetchPlaylist(playlistId), fetchPlaylistRecommendations(playlistId, 20)]);
  return { playlist, recommendations };
};
export const Route = createFileRoute('/playlists/$playlistId')({
  component: PlaylistDetailPage,
  loader,
});
