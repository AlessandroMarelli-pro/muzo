import { PlaylistList } from '@/components/playlist/playlist-list';
import { fetchPlaylists } from '@/services/playlist-hooks';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

function PlaylistsPage() {
  const navigate = useNavigate();

  const handleViewPlaylistDetails = (playlistId: string) => {
    navigate({ to: `/playlists/${playlistId}` });
  };

  return (
    <PlaylistList
      onViewPlaylistDetails={handleViewPlaylistDetails}
    />
  );
}

export const Route = createFileRoute('/playlists/')({
  component: PlaylistsPage,
  loader: () => fetchPlaylists('default'),
});
