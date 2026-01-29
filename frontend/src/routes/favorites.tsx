import { FavoriteList } from '@/components/favorites/favortite-list';
import {
  playlistByNameQueryOptions,
  playlistRecommendationsQueryOptions,
} from '@/services/playlist-hooks';
import { createFileRoute } from '@tanstack/react-router';

function FavoritesPage() {
  const handleRefresh = async () => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  const handleMoreTrack = (trackId: string) => {
    console.log('More options for track:', trackId);
    // Implement track options
  };

  return (
    <FavoriteList
      viewMode="grid"
      sortBy="title"
      sortOrder="asc"
      filterStatus="all"
      searchQuery=""
      onViewModeChange={(mode) => console.log('View mode changed:', mode)}
      onSortChange={(sortBy) => console.log('Sort changed:', sortBy)}
      onSortOrderChange={(order) => console.log('Sort order changed:', order)}
      onFilterChange={(status) => console.log('Filter changed:', status)}
      onSearchChange={(query) => console.log('Search changed:', query)}
      onRefresh={handleRefresh}
    />
  );
}

export const Route = createFileRoute('/favorites')({
  component: FavoritesPage,
  loader: async ({ context }) => {
    const playlist = await context.queryClient.ensureQueryData(
      playlistByNameQueryOptions('favorites'),
    );
    const recommendations = await context.queryClient.ensureQueryData(
      playlistRecommendationsQueryOptions(playlist.id, 20),
    );
    return { playlist, recommendations };
  },
  preload: true,
});
