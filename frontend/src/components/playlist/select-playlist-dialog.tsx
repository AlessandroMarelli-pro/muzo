import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useAddTrackToPlaylist, usePlaylists } from '@/services/playlist-hooks';
import { ListPlus } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from '../ui/button';
import { InlinePlaylistListComponent } from './playlist-list';

interface SelectPlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackId: string;
  artist: string;
  title: string;
}

export const SelectPlaylistTrigger = ({
  trackId,
  isDropdownMenuItem = true,
  artist,
  title,
}: {
  trackId: string;
  isDropdownMenuItem?: boolean;
  artist: string;
  title: string;
}) => {
  const [open, setOpen] = useState(false);
  const handleOpen = React.useCallback((e: React.PointerEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }, []);

  return (
    <>
      {isDropdownMenuItem ? (
        <DropdownMenuItem onPointerDown={handleOpen} onSelect={(e) => e.preventDefault()}>
          Add to Playlist
        </DropdownMenuItem>
      ) : (
        <Button onClick={handleOpen} variant="ghost" size="sm">
          {' '}
          <ListPlus className="w-4 h-4" />
        </Button>
      )}
      <SelectPlaylistDialog
        open={open}
        onOpenChange={setOpen}
        trackId={trackId}
        artist={artist}
        title={title}
      />
    </>
  );
};

export const SelectPlaylistDialog: React.FC<SelectPlaylistDialogProps> = ({
  open,
  onOpenChange,
  trackId,
  artist,
  title,
}) => {
  const { playlists, loading, refetch } = usePlaylists(undefined, trackId);
  const addTrackMutation = useAddTrackToPlaylist();
  const [_selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  const handleSelectPlaylist = async (playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    try {
      await addTrackMutation.mutateAsync({
        playlistId,
        input: {
          trackId,
        },
        artist,
        title,
      });
      // onOpenChange(false);
      setSelectedPlaylistId(null);
    } catch (error) {
      console.error('Failed to add track to playlist:', error);
      setSelectedPlaylistId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add to Playlist</DialogTitle>
          <DialogDescription>Select a playlist to add this track</DialogDescription>
        </DialogHeader>

        <div>
          <InlinePlaylistListComponent
            loading={loading}
            playlists={playlists}
            onUpdate={refetch}
            onCardClick={handleSelectPlaylist}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
