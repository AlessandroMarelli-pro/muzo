import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAddTrackToPlaylist, usePlaylists } from '@/services/playlist-hooks';
import { X } from 'lucide-react';
import React, { useState } from 'react';
import { Loading } from '../loading';

interface SelectPlaylistDialogProps {
  isOpen: boolean;
  onClose: () => void;
  trackId: string;
  onSuccess?: () => void;
}

export const SelectPlaylistDialog: React.FC<SelectPlaylistDialogProps> = ({
  isOpen,
  onClose,
  trackId,
  onSuccess,
}) => {
  const { playlists, loading } = usePlaylists();
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
      onSuccess?.();
      onClose();
      setSelectedPlaylistId(null);
    } catch (error) {
      console.error('Failed to add track to playlist:', error);
      setSelectedPlaylistId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50  flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md max-h-[80vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Add to Playlist</CardTitle>
              <CardDescription>
                Select a playlist to add this track
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loading />
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No playlists found. Create a playlist first.
            </div>
          ) : (
            <div className="space-y-2">
              {playlists.map((playlist) => (
                <Button
                  key={playlist.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4 border-none"
                  onClick={() => handleSelectPlaylist(playlist.id)}
                  disabled={
                    addTrackMutation.isPending &&
                    selectedPlaylistId === playlist.id
                  }
                >
                  <div className="flex flex-col items-start flex-1">
                    <span className="font-medium">{playlist.name}</span>
                    {playlist.description && (
                      <span className="text-sm text-muted-foreground">
                        {playlist.description}
                      </span>
                    )}
                    {playlist.numberOfTracks !== undefined && (
                      <span className="text-xs text-muted-foreground mt-1">
                        {playlist.numberOfTracks} tracks
                      </span>
                    )}
                  </div>
                  {addTrackMutation.isPending &&
                    selectedPlaylistId === playlist.id && (
                      <span className="ml-2 text-sm">Adding...</span>
                    )}
                </Button>
              ))}
            </div>
          )}

          {addTrackMutation.isError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">
                Failed to add track to playlist:{' '}
                {addTrackMutation.error?.message || 'Unknown error'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
