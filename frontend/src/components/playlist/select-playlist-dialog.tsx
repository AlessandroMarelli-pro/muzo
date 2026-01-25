import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useAddTrackToPlaylist, usePlaylists } from '@/services/playlist-hooks';
import React, { useState } from 'react';
import { InlinePlaylistListComponent } from './playlist-list';

interface SelectPlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackId: string;
}

export const SelectPlaylistTrigger = ({ trackId }: { trackId: string }) => {
  const [open, setOpen] = useState(false);
  const handleOpen = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
    },
    [],
  );

  return (
    <>
      <DropdownMenuItem onPointerDown={handleOpen} onSelect={(e) => e.preventDefault()}>
        Add to Playlist
      </DropdownMenuItem>
      <SelectPlaylistDialog
        open={open}
        onOpenChange={setOpen}
        trackId={trackId}
      />
    </>
  );
};

export const SelectPlaylistDialog: React.FC<SelectPlaylistDialogProps> = ({
  open,
  onOpenChange,
  trackId,
}) => {
  const { playlists, loading, refetch } = usePlaylists(undefined, undefined, trackId);
  const addTrackMutation = useAddTrackToPlaylist();
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    null,
  );


  const handleSelectPlaylist = async (playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    try {
      await addTrackMutation.mutateAsync({
        playlistId,
        input: {
          trackId,
        },
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
          <DialogDescription>
            Select a playlist to add this track
          </DialogDescription>
        </DialogHeader>

        <div>
          <InlinePlaylistListComponent loading={loading} playlists={playlists} onUpdate={refetch} onCardClick={handleSelectPlaylist} />

        </div>
      </DialogContent>
    </Dialog>
  );
};
