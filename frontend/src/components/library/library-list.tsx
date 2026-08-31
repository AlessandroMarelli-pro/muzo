import { Button } from '@/components/ui/button';
import { Route } from '@/routes/libraries.index';
import { useDeleteLibrary } from '@/services/api-hooks';
import { useRouter } from '@tanstack/react-router';
import { Library, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { NoData } from '../no-data';
import { SearchInput } from '@/components/ui/search-input';
import { LibraryCard } from './library-card';

interface LibraryListProps {
  onCreateLibrary: () => void;
  onScanLibrary: (libraryId: string) => void;
  onForceScanLibrary: (libraryId: string) => void;
  onScanIncompleteTracks: (libraryId: string) => void;
  onStopLibraryScan: (libraryId: string, sessionId: string) => void;
  onViewLibrary: (libraryId: string) => void;
  onPlayLibrary: (libraryId: string) => void;
  isScanning?: boolean;
}

export const LibraryList: React.FC<LibraryListProps> = ({
  onCreateLibrary,
  onScanLibrary,
  onForceScanLibrary,
  onScanIncompleteTracks,
  onViewLibrary,
  onPlayLibrary,
  onStopLibraryScan,
  isScanning = false,
}) => {
  const { libraries } = Route.useLoaderData();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredLibraries, setFilteredLibraries] = useState(libraries);
  const deleteLibraryMutation = useDeleteLibrary();

  useEffect(() => {
    setFilteredLibraries(
      libraries.filter((library) => library.name.toLowerCase().includes(searchQuery.toLowerCase())),
    );
  }, [searchQuery, libraries]);

  const handleDeleteLibrary = async (e: React.MouseEvent<HTMLButtonElement>, libraryId: string) => {
    const hasConfirmed = confirm('Are you sure you want to delete this library?');
    if (!hasConfirmed) {
      return;
    }
    await deleteLibraryMutation.mutateAsync(libraryId);
    await router.invalidate();
    e.stopPropagation();
    e.preventDefault();
  };
  const handleScanLibrary = (e: React.MouseEvent<HTMLButtonElement>, libraryId: string) => {
    e.stopPropagation();
    e.preventDefault();
    onScanLibrary(libraryId);
  };
  const handleForceScanLibrary = (e: React.MouseEvent<HTMLButtonElement>, libraryId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const hasConfirmed = confirm(
      'Force scan will re-analyze every track in this library, even ones already analyzed. This can take a while. Continue?',
    );
    if (!hasConfirmed) return;
    onForceScanLibrary(libraryId);
  };
  const handleScanIncompleteTracks = (
    e: React.MouseEvent<HTMLButtonElement>,
    libraryId: string,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const library = libraries.find((l) => l.id === libraryId);
    const incompleteCount = library ? Math.max(library.totalTracks - library.analyzedTracks, 0) : 0;
    const hasConfirmed = confirm(
      `Re-analyze the ${incompleteCount} track(s) in this library that haven't been fully analyzed yet?`,
    );
    if (!hasConfirmed) return;
    onScanIncompleteTracks(libraryId);
  };
  const handleStopLibraryScan = (
    e: React.MouseEvent<HTMLButtonElement>,
    libraryId: string,
    sessionId: string,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    onStopLibraryScan(libraryId, sessionId);
  };
  return (
    <PageShell>
      <PageHeader title="Libraries" description="Folders Muzo scans for music.">
        <SearchInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Filter libraries…"
          className="sm:w-64"
        />
        <Button onClick={onCreateLibrary} size="sm" variant="link">
          <Plus className="h-4 w-4" />
          Add new library
        </Button>
      </PageHeader>

      {filteredLibraries?.length === 0 ? (
        <NoData
          Icon={Library}
          title={searchQuery ? 'No libraries match your filter' : 'No libraries yet'}
          subtitle={
            searchQuery
              ? `Nothing matches "${searchQuery}".`
              : 'Add a folder of music and Muzo will scan and analyse it.'
          }
          buttonAction={searchQuery ? () => setSearchQuery('') : onCreateLibrary}
          buttonLabel={searchQuery ? 'Clear filter' : 'Add new library'}
          ButtonIcon={searchQuery ? undefined : Plus}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredLibraries?.map((library) => (
            <LibraryCard
              key={library.id}
              library={library}
              onScan={handleScanLibrary}
              onForceScan={handleForceScanLibrary}
              onScanIncompleteTracks={handleScanIncompleteTracks}
              onStopScan={handleStopLibraryScan}
              onView={() => onViewLibrary(library.id)}
              onPlay={() => onPlayLibrary(library.id)}
              isScanning={isScanning}
              onDelete={(e) => handleDeleteLibrary(e, library.id)}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
};
