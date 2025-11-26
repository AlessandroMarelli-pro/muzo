import { CategoriesTrackList } from '@/components/categories';
import { createFileRoute } from '@tanstack/react-router';

function CategoriesPage() {
  const handleRefresh = async () => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  const handleMoreTrack = (trackId: string) => {
    console.log('More options for track:', trackId);
    // Implement track options
  };

  return (
    <CategoriesTrackList
      viewMode="grid"
      sortBy="title"
      sortOrder="asc"
      filterStatus="all"
      searchQuery=""
      onMore={handleMoreTrack}
      onViewModeChange={(mode) => console.log('View mode changed:', mode)}
      onSortChange={(sortBy) => console.log('Sort changed:', sortBy)}
      onSortOrderChange={(order) => console.log('Sort order changed:', order)}
      onFilterChange={(status) => console.log('Filter changed:', status)}
      onSearchChange={(query) => console.log('Search changed:', query)}
      onRefresh={handleRefresh}
    />
  );
}

export const Route = createFileRoute('/categories')({
  component: CategoriesPage,
});
