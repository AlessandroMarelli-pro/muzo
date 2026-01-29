import { Button } from '@/components/ui/button';
import { Route } from '@/routes/libraries.index';
import { Plus, Search } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Loading } from '../loading';
import { Input } from '../ui/input';
import { LibraryCard } from './library-card';

interface LibraryListProps {
  onCreateLibrary: () => void;
  onScanLibrary: (libraryId: string) => void;
  onViewLibrary: (libraryId: string) => void;
  onPlayLibrary: (libraryId: string) => void;
  onDeleteLibrary: (e: React.MouseEvent<HTMLButtonElement>, libraryId: string) => void;
  isScanning?: boolean;
}

export const LibraryList: React.FC<LibraryListProps> = ({
  onCreateLibrary,
  onScanLibrary,
  onViewLibrary,
  onPlayLibrary,
  onDeleteLibrary,
  isScanning = false,
}) => {
  const isLoading = false;
  const libraries = Route.useLoaderData();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredLibraries, setFilteredLibraries] = useState(libraries);

  useEffect(() => {
    setFilteredLibraries(libraries.filter((library) =>
      library.name.toLowerCase().includes(searchQuery.toLowerCase()),
    ));
  }, [searchQuery, libraries]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  if (isLoading) {
    return <Loading />;
  }


  const handleScanLibrary = (e: React.MouseEvent<HTMLButtonElement>, libraryId: string) => {
    e.stopPropagation();
    e.preventDefault();
    onScanLibrary(libraryId);
  };
  return (
    <div className="p-6  flex flex-col z-0 gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-row justify-between items-center w-full">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Filter libraries..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border  rounded-md "
            />
          </div>

          <Button onClick={onCreateLibrary} size="sm" variant="link">
            <Plus className="h-4 w-4" />
            Add new library
          </Button>
        </div>
      </div>

      <div className="flex flex-row flex-wrap gap-5 justify-start">
        {filteredLibraries?.map((library) => (
          <LibraryCard
            key={library.id}
            library={library}
            onScan={handleScanLibrary}
            onView={() => onViewLibrary(library.id)}
            onPlay={() => onPlayLibrary(library.id)}
            isScanning={isScanning}
            onDelete={(e) => onDeleteLibrary(e, library.id)}
          />
        ))}
      </div>
    </div>
  );
};
