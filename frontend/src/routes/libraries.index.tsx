import { CreateLibraryDialog } from '@/components/library/create-library-dialog';
import { LibraryList } from '@/components/library/library-list';
import { useScanSessionContext } from '@/contexts/scan-session.context';
import { librariesQueryOptions } from '@/services/api-hooks';
import { useStartLibraryScan, useStopLibraryScan } from '@/services/job-scheduler-hooks';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

function LibrariesPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const scanLibraryMutation = useStartLibraryScan();
  const stopLibraryScanMutation = useStopLibraryScan();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addSession, removeSession, getSessionForLibrary } = useScanSessionContext();

  const handleCreateLibrarySuccess = (library: { id: string }) => {
    setIsCreateDialogOpen(false);
    handleScanLibrary(library.id);
  };

  const handleScanLibrary = (libraryId: string) => {
    scanLibraryMutation.mutate(
      { libraryId, incremental: true },
      {
        onSuccess: (sessionId) => {
          // Store sessionId for progress tracking
          if (sessionId) {
            addSession(sessionId, libraryId);
          }
        },
        onError: (error) => {
          console.error('Failed to start library scan:', error);
        },
      },
    );
  };

  const handleViewLibrary = (libraryId: string) => {
    navigate({ to: `/libraries/${libraryId}` });
  };

  const handlePlayLibrary = (libraryId: string) => {
    console.log('Playing library:', libraryId);
    // Implement library playback
  };

  const handleStopLibraryScan = (libraryId: string) => {
    const session = getSessionForLibrary(libraryId);
    if (!session) {
      // Nothing to stop for this library — never guess by grabbing an unrelated session.
      return;
    }
    stopLibraryScanMutation.mutate(
      { libraryId, sessionId: session.sessionId },
      {
        onSuccess: (stopped) => {
          // The backend deletes the session outright rather than completing it, so there's
          // no scan.complete SSE event to trigger cleanup -- remove it from context directly,
          // or the UI keeps showing stale "Scanning..." progress indefinitely.
          if (stopped) {
            removeSession(session.sessionId);
            // library.scanStatus is also cached from the last fetch; refetch it so the card's
            // fallback (used once the session above is gone) reflects the server's IDLE status
            // instead of the stale SCANNING value from before the stop.
            queryClient.invalidateQueries({ queryKey: librariesQueryOptions().queryKey });
          }
        },
        onError: (error) => {
          console.error('Failed to stop library scan:', error);
        },
      },
    );
  };

  return (
    <>
      <LibraryList
        onCreateLibrary={() => setIsCreateDialogOpen(true)}
        onScanLibrary={handleScanLibrary}
        onStopLibraryScan={handleStopLibraryScan}
        onViewLibrary={handleViewLibrary}
        onPlayLibrary={handlePlayLibrary}
        isScanning={scanLibraryMutation.isPending}
      />

      <CreateLibraryDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleCreateLibrarySuccess}
      />
    </>
  );
}

export const Route = createFileRoute('/libraries/')({
  component: LibrariesPage,
  loader: async ({ context }) => ({
    libraries: await context.queryClient.ensureQueryData(librariesQueryOptions()),
  }),
  preload: true,
});
