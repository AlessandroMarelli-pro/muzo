import { CreateLibraryDialog } from '@/components/library/create-library-dialog';
import { LibraryList } from '@/components/library/library-list';
import { useScanSessionContext } from '@/contexts/scan-session.context';
import { librariesQueryOptions } from '@/services/api-hooks';
import { useScanLibrary } from '@/services/rest-client';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

function LibrariesPage() {
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const scanLibraryMutation = useScanLibrary();
	const navigate = useNavigate();
	const { addSession } = useScanSessionContext();

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

	return (
		<>
			<LibraryList
				onCreateLibrary={() => setIsCreateDialogOpen(true)}
				onScanLibrary={handleScanLibrary}
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
