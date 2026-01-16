import {
  Playlist as GraphQLPlaylist,
  PlaylistTrack,
} from '@/__generated__/types';
import { Card, CardContent } from '@/components/ui/card';

import {
  useRemoveTrackFromPlaylist,
  useUpdatePlaylistPositions,
} from '@/services/playlist-hooks';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
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
  const [localTracks, setLocalTracks] = useState<PlaylistTrack[]>(
    playlist.tracks,
  );
  const removeTrackMutation = useRemoveTrackFromPlaylist('default');
  const updatePositionsMutation = useUpdatePlaylistPositions('default');

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  const trackIds = useMemo(
    () => localTracks.map((track) => track.id),
    [localTracks],
  );

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active || !over || active.id !== over.id) {
      const oldIndex = trackIds.indexOf(active.id as string);
      const newIndex = trackIds.indexOf(over?.id as string);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Optimistically update local state
        const newTracks = arrayMove(localTracks, oldIndex, newIndex);
        setLocalTracks(newTracks);

        // Update positions in backend
        try {
          const positions = newTracks.map((track, index) => ({
            trackId: track.track.id,
            position: index + 1,
          }));
          await updatePositionsMutation.mutateAsync({
            playlistId: playlist.id,
            positions,
          });
          onUpdate();
        } catch (error) {
          console.error('Failed to update playlist positions:', error);
          // Revert on error
          setLocalTracks(playlist.tracks);
        }
      }
    }
  };

  if (localTracks.length === 0) {
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
        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <SortableContext
            items={trackIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="divide-y">
              {localTracks.map((playlistTrack) => (
                <SortablePlaylistTrack
                  key={playlistTrack.id}
                  playlistTrack={playlistTrack}
                  onRemove={handleRemoveTrack}
                  removingTrackId={removingTrackId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}

function SortablePlaylistTrack({
  playlistTrack,
  onRemove,
  removingTrackId,
}: {
  playlistTrack: PlaylistTrack;
  onRemove: (trackId: string) => void;
  removingTrackId: string | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: playlistTrack.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <PlaylistTrackListCard
        playlistTrack={playlistTrack}
        handleRemoveTrack={onRemove}
        removingTrackId={removingTrackId}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
