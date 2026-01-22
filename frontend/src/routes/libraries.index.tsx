import { CreateLibraryDialog } from '@/components/library/create-library-dialog';
import { LibraryList } from '@/components/library/library-list';
import { useScanSessionContext } from '@/contexts/scan-session.context';
import { useScanLibrary } from '@/services/rest-client';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

function LibrariesPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const scanLibraryMutation = useScanLibrary();
  const navigate = useNavigate();
  const { addSession } = useScanSessionContext();

  const handleRefresh = async () => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  const handleCreateLibrarySuccess = () => {
    console.log('Library created successfully');
    setIsCreateDialogOpen(false);
  };

  const handleScanLibrary = (libraryId: string) => {
    console.log('Scanning library:', libraryId);
    scanLibraryMutation.mutate(libraryId, {
      onSuccess: (data) => {
        console.log('Library scan started successfully', data);
        // Store sessionId for progress tracking
        if (data.sessionId) {
          addSession(data.sessionId, libraryId);
        }
      },
      onError: (error) => {
        console.error('Failed to start library scan:', error);
      },
    });
  };

  const handleViewLibrary = (libraryId: string) => {
    console.log('Viewing library:', libraryId);
    navigate({ to: `/libraries/${libraryId}` });
  };

  const handlePlayLibrary = (libraryId: string) => {
    console.log('Playing library:', libraryId);
    // Implement library playback
  };

  return (
    <>
      <LibraryList
        onCreateLibrary={() => setIsCreateDialogOpen(true)}
        onScanLibrary={handleScanLibrary}
        onViewLibrary={handleViewLibrary}
        onPlayLibrary={handlePlayLibrary}
        onRefresh={handleRefresh}
        isScanning={scanLibraryMutation.isPending}
      />

      <CreateLibraryDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={handleCreateLibrarySuccess}
      />
    </>
  );
}

export const Route = createFileRoute('/libraries/')({
  component: LibrariesPage,
});
