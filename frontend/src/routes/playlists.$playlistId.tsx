import { PlaylistDetail } from '@/components/playlist';
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

export const Route = createFileRoute('/playlists/$playlistId')({
  component: PlaylistDetailPage,
});
