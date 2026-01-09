import { Playlist as GraphQLPlaylist } from '@/__generated__/types';
import { Card, CardContent } from '@/components/ui/card';
import { useQueue } from '@/contexts/audio-player-context';
import { useRemoveTrackFromPlaylist } from '@/services/playlist-hooks';
import { Clock } from 'lucide-react';
import { useState } from 'react';
import { PlaylistTrackListCard } from './playlist-track-list-card';

interface PlaylistTracksListProps {
  playlist: GraphQLPlaylist;
  onUpdate: () => void;
}

export function PlaylistTracksList({
  playlist,
  onUpdate,
}: PlaylistTracksListProps) {
  const [removingTrackId, setRemovingTrackId] = useState<string | null>(null);
  const { setQueue } = useQueue();
  const removeTrackMutation = useRemoveTrackFromPlaylist('default');

  const handleSetQueue = () => {
    setQueue(playlist.tracks.map((track) => track.track));
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!confirm('Remove this track from the playlist?')) {
      return;
    }

    setRemovingTrackId(trackId);
    try {
      await removeTrackMutation.mutateAsync({
        playlistId: playlist.id,
        trackId,
      });
      onUpdate();
    } catch (error) {
      console.error('Failed to remove track:', error);
    } finally {
      setRemovingTrackId(null);
    }
  };

  const handlePlayTrack = (trackId: string) => {
    // TODO: Implement play track functionality
    console.log('Play track:', trackId);
  };

  if (playlist.tracks.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <div className="space-y-4">
            <div className="text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">
                No tracks in this playlist
              </h3>
              <p>Add some tracks to get started</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-0">
      <CardContent className="p-0">
        <div className="divide-y">
          {playlist.tracks.map((playlistTrack, index) => (
            <PlaylistTrackListCard
              playlistTrack={playlistTrack}
              index={index}
              handleRemoveTrack={handleRemoveTrack}
              removingTrackId={removingTrackId}
              setQueue={handleSetQueue}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
