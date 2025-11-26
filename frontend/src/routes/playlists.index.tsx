import { PlaylistList } from '@/components/playlist';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

function PlaylistsPage() {
  const navigate = useNavigate();

  const handleViewPlaylistDetails = (playlistId: string) => {
    navigate({ to: `/playlists/${playlistId}` });
  };

  return <PlaylistList onViewPlaylistDetails={handleViewPlaylistDetails} />;
}

export const Route = createFileRoute('/playlists/')({
  component: PlaylistsPage,
});
