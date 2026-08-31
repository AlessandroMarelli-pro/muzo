import { Playlist } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import { Route } from '@/routes/playlists.index';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { SearchInput } from '@/components/ui/search-input';
import { CreatePlaylistDialog } from './create-playlist-dialog';
import { InlinePlaylistCard, InlinePlaylistCardSkeleton } from './inline-playlist-card';
import { PlaylistCard, PlaylistCardSkeleton } from './playlist-card';

interface PlaylistListProps {
  onViewPlaylistDetails: (playlistId: string) => void;
  refetch?: () => void;
  loading?: boolean;
}

export const PlaylistListComponent = ({
  loading,
  playlists,
  onViewPlaylistDetails,
  onCardClick,
}: {
  onViewPlaylistDetails?: (playlistId: string) => void;
  playlists: Playlist[];
  loading: boolean;
  onCardClick?: (playlistId: string) => void;
}) => {
  return (
    <div className="flex flex-row flex-wrap gap-5 justify-start ">
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
            onViewDetails={onViewPlaylistDetails}
            onCardClick={onCardClick}
          />
        ))
      )}
    </div>
  );
};

export const InlinePlaylistListComponent = ({
  loading,
  playlists,
  onCardClick,
}: {
  onViewPlaylistDetails?: (playlistId: string) => void;
  playlists: (Playlist & { disabled?: boolean })[];
  onUpdate: () => void;
  loading: boolean;
  onCardClick?: (playlistId: string) => void;
}) => {
  return (
    <div className="flex flex-col flex-wrap gap-4 justify-start ">
      {loading ? (
        <>
          {Array.from({ length: 10 }).map((_, index) => (
            <InlinePlaylistCardSkeleton key={index} />
          ))}
        </>
      ) : (
        playlists.map((playlist) => (
          <InlinePlaylistCard key={playlist.id} playlist={playlist} onCardClick={onCardClick} />
        ))
      )}
    </div>
  );
};

export function PlaylistList({ onViewPlaylistDetails, loading = false }: PlaylistListProps) {
  const playlists = Route.useLoaderData() as Playlist[];

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

  return (
    <PageShell>
      <PageHeader title="Playlists" description="Collections you've built.">
        <SearchInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Filter playlists…"
          className="sm:w-64"
        />
        <Button onClick={handleCreatePlaylist} size="sm" variant="link">
          <Plus className="h-4 w-4" />
          Create Playlist
        </Button>
      </PageHeader>
      <PlaylistListComponent
        loading={loading}
        playlists={filteredPlaylists}
        onViewPlaylistDetails={onViewPlaylistDetails}
      />
      <CreatePlaylistDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          setIsCreateDialogOpen(false);
        }}
      />
    </PageShell>
  );
}
