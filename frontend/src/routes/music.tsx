import { TrackList } from '@/components/track/track-list';
import { createFileRoute } from '@tanstack/react-router';

function MusicPage() {
  const handleRefresh = async () => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };
  console.log('render MusicPage');
  return (
    <TrackList
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

export const Route = createFileRoute('/music')({
  component: MusicPage,
});
