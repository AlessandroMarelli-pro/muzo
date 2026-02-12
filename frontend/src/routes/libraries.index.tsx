import { CreateLibraryDialog } from '@/components/library/create-library-dialog';
import { LibraryList } from '@/components/library/library-list';
import { useScanSessionContext } from '@/contexts/scan-session.context';
import { librariesQueryOptions } from '@/services/api-hooks';
import {
	useStartLibraryScan,
	useStopLibraryScan,
} from '@/services/job-scheduler-hooks';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

function LibrariesPage() {
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const scanLibraryMutation = useStartLibraryScan();
	const stopLibraryScanMutation = useStopLibraryScan();
	const navigate = useNavigate();
	const { addSession, activeSessions } = useScanSessionContext();

	const handleCreateLibrarySuccess = () => {
		setIsCreateDialogOpen(false);
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
			}
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
		stopLibraryScanMutation.mutate({
			libraryId,
			sessionId:
				activeSessions.get(libraryId)?.sessionId ??
				activeSessions.keys().next().value ??
				'',
		});
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
		libraries: await context.queryClient.ensureQueryData(
			librariesQueryOptions()
		),
	}),
	preload: true,
});
