import { LibraryDashboard } from '@/components/visualization/library-dashboard';
import { createFileRoute } from '@tanstack/react-router';

function LibraryDashboardPage() {
  const { libraryId } = Route.useParams();

  const handleRefresh = async () => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <LibraryDashboard
      libraryId={libraryId}
      onRefresh={handleRefresh}
      onExportData={() => console.log('Export data')}
      onShareLibrary={() => console.log('Share library')}
    />
  );
}

export const Route = createFileRoute('/libraries/$libraryId')({
  component: LibraryDashboardPage,
});
