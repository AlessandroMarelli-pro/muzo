import { CreateLibraryDialog } from '@/components/library/create-library-dialog';
import { LibraryList } from '@/components/library/library-list';
import { useScanSessionContext } from '@/contexts/scan-session.context';
import { useDeleteLibrary } from '@/services/api-hooks';
import { useScanLibrary } from '@/services/rest-client';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

function LibrariesPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const scanLibraryMutation = useScanLibrary();
  const navigate = useNavigate();
  const { addSession } = useScanSessionContext();

  const deleteLibraryMutation = useDeleteLibrary();

  const handleCreateLibrarySuccess = () => {
    setIsCreateDialogOpen(false);
  };

  const handleScanLibrary = (libraryId: string) => {
    scanLibraryMutation.mutate(libraryId, {
      onSuccess: (data) => {
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
    navigate({ to: `/libraries/${libraryId}` });
  };

  const handlePlayLibrary = (libraryId: string) => {
    console.log('Playing library:', libraryId);
    // Implement library playback
  };

  const handleDeleteLibrary = (e: React.MouseEvent<HTMLButtonElement>, libraryId: string) => {
    const hasConfirmed = confirm('Are you sure you want to delete this library?');
    if (!hasConfirmed) {
      return;
    }
    deleteLibraryMutation.mutate(libraryId);
    e.stopPropagation();
    e.preventDefault();

  }
  return (
    <>
      <LibraryList
        onCreateLibrary={() => setIsCreateDialogOpen(true)}
        onScanLibrary={handleScanLibrary}
        onViewLibrary={handleViewLibrary}
        onPlayLibrary={handlePlayLibrary}
        onDeleteLibrary={handleDeleteLibrary}
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
