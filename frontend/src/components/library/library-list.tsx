import { Button } from '@/components/ui/button';
import { useLibraries } from '@/services/api-hooks';
import { Plus, RefreshCw } from 'lucide-react';
import React from 'react';
import { Loading } from '../loading';
import { NoData } from '../no-data';
import { LibraryCard } from './library-card';

interface LibraryListProps {
  onCreateLibrary: () => void;
  onScanLibrary: (libraryId: string) => void;
  onViewLibrary: (libraryId: string) => void;
  onPlayLibrary: (libraryId: string) => void;
  onRefresh: () => void;
  isScanning?: boolean;
}

export const LibraryList: React.FC<LibraryListProps> = ({
  onCreateLibrary,
  onScanLibrary,
  onViewLibrary,
  onPlayLibrary,
  onRefresh,
  isScanning = false,
}) => {
  const { data: libraries, isLoading } = useLibraries();

  if (isLoading) {
    return <Loading />;
  }

  if (libraries && libraries.length === 0) {
    return (
      <NoData
        Icon={Plus}
        title="No Music Libraries Found"
        subtitle="Create your first music library to start organizing your music collection."
        buttonAction={onCreateLibrary}
        buttonLabel="Create Library"
        ButtonIcon={Plus}
      />
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-8 flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Music Libraries</h2>
          <p className="text-muted-foreground">
            {libraries.length}{' '}
            {libraries.length === 1 ? 'library' : 'libraries'} found
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={onCreateLibrary}>
            <Plus className="h-4 w-4 mr-2" />
            Create Library
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {libraries?.map((library) => (
          <LibraryCard
            key={library.id}
            library={library}
            onScan={() => onScanLibrary(library.id)}
            onView={() => onViewLibrary(library.id)}
            onPlay={() => onPlayLibrary(library.id)}
            isScanning={isScanning}
          />
        ))}
      </div>
    </div>
  );
};
