import { PlaylistList } from '@/components/playlist/playlist-list';
import { usePlaylists } from '@/services/playlist-hooks';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

function PlaylistsPage() {
  const navigate = useNavigate();

  const handleViewPlaylistDetails = (playlistId: string) => {
    navigate({ to: `/playlists/${playlistId}` });
  };
  const { playlists = [], refetch } = usePlaylists('default');

  return (
    <PlaylistList
      onViewPlaylistDetails={handleViewPlaylistDetails}
      playlists={playlists}
      refetch={refetch}
    />
  );
}

export const Route = createFileRoute('/playlists/')({
  component: PlaylistsPage,
});
