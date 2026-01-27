import { PlaylistList } from '@/components/playlist/playlist-list';
import { fetchPlaylists } from '@/services/playlist-hooks';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

const IMAGE_SERVE_BASE = 'http://localhost:3000/api/images/serve';

function prefetchPlaylistImages(playlists: { images?: string[] }[]) {
  if (typeof window === 'undefined') return;
  const urls = playlists.flatMap((p) =>
    (p.images ?? []).slice(0, 4).map(
      (path) => `${IMAGE_SERVE_BASE}?imagePath=${encodeURIComponent(path)}`,
    ),
  );
  urls.forEach((url) => {
    const img = new Image();
    img.src = url;
  });
}

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
  loader: async () => {
    const playlists = await fetchPlaylists('default');
    prefetchPlaylistImages(playlists);
    return playlists;
  },
  preload: true,
});
