import { Button } from '@/components/ui/button';
import { usePlaylists } from '@/services/playlist-hooks';
import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Loading } from '../loading';
import { Input } from '../ui/input';
import { CreatePlaylistDialog } from './create-playlist-dialog';
import { PlaylistCard } from './playlist-card';

interface PlaylistListProps {
  onViewPlaylistDetails: (playlistId: string) => void;
}

export function PlaylistList({ onViewPlaylistDetails }: PlaylistListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { playlists, loading, error, refetch } = usePlaylists('default');

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">Error loading playlists: {error}</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  const handleCreatePlaylist = () => {
    setIsCreateDialogOpen(true);
  };
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  return (
    <div className="p-6  flex flex-col z-0 gap-4">
      {/*   <PlaylistTable
        data={playlists}
        onUpdate={refetch}
        onViewDetails={onViewPlaylistDetails}
        isLoading={false}
        onCreatePlaylist={handleCreatePlaylist}
      /> */}
      <div className="flex flex-row justify-between items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search playlists..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <Button onClick={handleCreatePlaylist} size="sm" variant="link">
          <Plus className="h-4 w-4" />
          Create Playlist
        </Button>
      </div>
      <div className="flex flex-row flex-wrap gap-6 justify-start">
        {playlists.map((playlist) => (
          <PlaylistCard
            key={playlist.id}
            playlist={playlist}
            onUpdate={refetch}
            onViewDetails={onViewPlaylistDetails}
          />
        ))}
      </div>
      <CreatePlaylistDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          setIsCreateDialogOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
