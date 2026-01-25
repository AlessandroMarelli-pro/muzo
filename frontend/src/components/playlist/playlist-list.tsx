import { PlaylistItem } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Input } from '../ui/input';
import { CreatePlaylistDialog } from './create-playlist-dialog';
import { InlinePlaylistCard, InlinePlaylistCardSkeleton } from './inline-playlist-card';
import { PlaylistCard, PlaylistCardSkeleton } from './playlist-card';

interface PlaylistListProps {
  onViewPlaylistDetails: (playlistId: string) => void;
  playlists: PlaylistItem[];
  refetch: () => void;
  loading: boolean;
}

export const PlaylistListComponent = ({ loading, playlists, onUpdate, onViewPlaylistDetails, onCardClick }: {
  onViewPlaylistDetails?: (playlistId: string) => void;
  playlists: PlaylistItem[];
  onUpdate: () => void;
  loading: boolean; onCardClick?: (playlistId: string) => void
}) => {
  return <div className="flex flex-row flex-wrap gap-4 justify-start ">
    {loading ? (
      <>
        {Array.from({ length: 10 }).map((_, index) => (
          <PlaylistCardSkeleton key={index} />
        ))}
      </>
    ) : (
      playlists.map((playlist) => (
        <PlaylistCard
          key={playlist.id}
          playlist={playlist}
          onUpdate={onUpdate}
          onViewDetails={onViewPlaylistDetails}
          onCardClick={onCardClick}
        />
      ))
    )}
  </div>
}

export const InlinePlaylistListComponent = ({ loading, playlists, onCardClick }: {
  onViewPlaylistDetails?: (playlistId: string) => void;
  playlists: (PlaylistItem & { disabled?: boolean })[];
  onUpdate: () => void;
  loading: boolean; onCardClick?: (playlistId: string) => void
}) => {
  return <div className="flex flex-col flex-wrap gap-4 justify-start ">
    {loading ? (
      <>
        {Array.from({ length: 10 }).map((_, index) => (
          <InlinePlaylistCardSkeleton key={index} />
        ))}
      </>
    ) : (
      playlists.map((playlist) => (
        <InlinePlaylistCard
          key={playlist.id}
          playlist={playlist}
          onCardClick={onCardClick}
        />
      ))
    )}
  </div>
}

export function PlaylistList({
  onViewPlaylistDetails,
  playlists,
  loading,
  refetch,
}: PlaylistListProps) {
  const [filteredPlaylists, setFilteredPlaylists] = useState(playlists);
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    setFilteredPlaylists(
      playlists.filter((playlist) =>
        playlist.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    );
  }, [searchQuery, playlists]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
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
            placeholder="Filter playlists..."
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
      <PlaylistListComponent loading={loading} playlists={filteredPlaylists} onUpdate={refetch} onViewPlaylistDetails={onViewPlaylistDetails} />
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
