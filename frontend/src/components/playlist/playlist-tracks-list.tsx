import { PlaylistTrack } from '@/__generated__/types';
import { Card, CardContent } from '@/components/ui/card';

import { Playlist } from '@/__generated__/types';
import { capitalizeEveryWord } from '@/lib/utils';
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
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  PlaylistTrackListCard,
  PlaylistTrackListCardSkeleton,
} from './playlist-track-list-card';

interface PlaylistTracksListProps {
  playlist: Playlist | undefined;
  onUpdate: () => void;
  isLoading: boolean;
  addTrackToPlaylist: (trackId: string) => void;
}

export function PlaylistTracksList({
  playlist,
  onUpdate,
  isLoading,
  addTrackToPlaylist,
}: PlaylistTracksListProps) {
  const [removingTrackId, setRemovingTrackId] = useState<string | null>(null);
  const [localTracks, setLocalTracks] = useState<PlaylistTrack[]>(
    playlist?.tracks || [],
  );
  const removeTrackMutation = useRemoveTrackFromPlaylist('default');
  const updatePositionsMutation = useUpdatePlaylistPositions('default');

  // Sync localTracks with playlist.tracks when playlist changes (e.g., after sorting)
  // Use a stringified version of track IDs and positions to detect order changes
  const tracksSignature = useMemo(
    () => playlist?.tracks?.map((t) => `${t.id}:${t.position}`).join(','),
    [playlist?.tracks],
  );

  useEffect(() => {
    setLocalTracks(playlist?.tracks || []);
  }, [tracksSignature, playlist?.tracks]);

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  const trackIds = useMemo(
    () => localTracks.map((track) => track.id),
    [localTracks],
  );

  const handleRemoveTrack = async (trackId: string,) => {

    const track = localTracks.find((track) => track.track.id === trackId);

    const trackName = `${track?.track?.title} by ${track?.track?.artist}`;
    setRemovingTrackId(trackId);
    try {
      await removeTrackMutation.mutateAsync({
        playlistId: playlist?.id || '',
        trackId,
      });
      toast.success(`Track removed from playlist`, {
        description: capitalizeEveryWord(trackName),
        action: {
          label: 'Undo',
          onClick: () => {
            addTrackToPlaylist(trackId);
          },
        },
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
    const sortingOrder = playlist?.sorting?.sortingDirection === 'asc' ? 1 : -1;
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
            position:
              sortingOrder > 0
                ? index + 1
                : playlist?.tracks?.length || 0 - index,
          }));
          await updatePositionsMutation.mutateAsync({
            playlistId: playlist?.id || '',
            positions,
          });
          onUpdate();
        } catch (error) {
          console.error('Failed to update playlist positions:', error);
          // Revert on error
          setLocalTracks(playlist?.tracks || []);
        }
      }
    }
  };

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
              {!isLoading && localTracks.length > 0
                ? localTracks.map((playlistTrack, index) => (
                  <SortablePlaylistTrack
                    key={playlistTrack.id}
                    playlistTrack={playlistTrack}
                    onRemove={handleRemoveTrack}
                    removingTrackId={removingTrackId}
                    index={index}
                    playlistLength={localTracks.length}
                  />
                ))
                : Array.from({ length: 5 }).map((_, i) => (
                  <PlaylistTrackListCardSkeleton
                    key={`playlist-tracks-list-skeleton-${i}`}
                    position={i + 1}
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
  index,
  playlistLength,
}: {
  playlistTrack: PlaylistTrack;
  onRemove: (trackId: string) => void;
  removingTrackId: string | null;
  index: number;
  playlistLength: number;
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
        index={index}
        playlistLength={playlistLength}
      />
    </div>
  );
}
