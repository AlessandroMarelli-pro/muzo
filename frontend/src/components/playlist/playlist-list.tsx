import { Button } from '@/components/ui/button';
import { usePlaylists } from '@/services/playlist-hooks';
import { Music, Plus } from 'lucide-react';
import { useState } from 'react';
import { Loading } from '../loading';
import { NoData } from '../no-data';
import { CreatePlaylistDialog } from './create-playlist-dialog';
import { PlaylistCard } from './playlist-card';

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

  return (
    <div className="p-4 space-y-4 flex flex-col z-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            Manage your music collections and discover new tracks
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          size="sm"
          variant="secondary"
        >
          <Plus className="h-4 w-4" />
          Create Playlist
        </Button>
      </div>

      {playlists.length === 0 ? (
        <NoData
          Icon={Music}
          title="No Playlists Found"
          subtitle="Create your first playlist to organize your music"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {playlists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              onUpdate={refetch}
              onViewDetails={onViewPlaylistDetails}
            />
          ))}
        </div>
      )}

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
