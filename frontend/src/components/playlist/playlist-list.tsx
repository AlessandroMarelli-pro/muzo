import { Button } from '@/components/ui/button';
import { usePlaylists } from '@/services/playlist-hooks';
import { useState } from 'react';
import { Loading } from '../loading';
import { CreatePlaylistDialog } from './create-playlist-dialog';
import { PlaylistTable } from './playlist-table';

interface PlaylistListProps {
  onViewPlaylistDetails: (playlistId: string) => void;
}

export function PlaylistList({ onViewPlaylistDetails }: PlaylistListProps) {
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
  return (
    <div className="p-6  flex flex-col z-0">
      <PlaylistTable
        data={playlists}
        onUpdate={refetch}
        onViewDetails={onViewPlaylistDetails}
        isLoading={false}
        onCreatePlaylist={handleCreatePlaylist}
      />

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
