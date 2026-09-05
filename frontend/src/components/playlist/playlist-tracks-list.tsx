import { PlaylistTrack, Track } from '@/__generated__/types';
import { Card, CardContent } from '@/components/ui/card';

import { Playlist } from '@/__generated__/types';
import { capitalizeEveryWord } from '@/lib/utils';
import {
  useBackendAutomixOrder,
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  PlaylistLedgerHeader,
  PlaylistTrackListCard,
  PlaylistTrackListCardSkeleton,
} from './playlist-track-list-card';

export interface PlaylistTracksListHandle {
  scrollToPosition: (position: number) => void;
  runAutomix: (seedTrackId?: string) => Promise<void>;
}

interface PlaylistTracksListProps {
  playlist: Playlist | undefined;
  onUpdate: () => void;
  isLoading: boolean;
  addTrackToPlaylist: (trackId: string, artist: string, title: string) => void;
  handleRef?: React.Ref<PlaylistTracksListHandle>;
}

export function PlaylistTracksList({
  playlist,
  onUpdate,
  isLoading,
  addTrackToPlaylist,
  handleRef,
}: PlaylistTracksListProps) {
  const [removingTrackId, setRemovingTrackId] = useState<string | null>(null);
  const [localTracks, setLocalTracks] = useState<PlaylistTrack[]>(playlist?.tracks || []);
  const listRef = useRef<HTMLDivElement>(null);

  const removeTrackMutation = useRemoveTrackFromPlaylist();
  const updatePositionsMutation = useUpdatePlaylistPositions();
  const backendAutomixMutation = useBackendAutomixOrder();

  // Sync localTracks with playlist.tracks when the playlist changes (e.g. after
  // sorting). Keyed only on a signature of ids+positions so a fresh array
  // reference from a background refetch that didn't actually reorder anything
  // doesn't trigger an extra state write + render.
  const tracksSignature = useMemo(
    () => playlist?.tracks?.map((t) => `${t.id}:${t.position}`).join(','),
    [playlist?.tracks],
  );

  useEffect(() => {
    setLocalTracks(playlist?.tracks || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracksSignature]);

  const flashRow = useCallback((position: number) => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-track-row][data-position="${position}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-1', 'ring-primary', 'ring-inset');
    window.setTimeout(() => el.classList.remove('ring-1', 'ring-primary', 'ring-inset'), 1400);
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    // Without the sortable coordinate getter, arrow-key reordering doesn't
    // understand the list geometry and moves items erratically.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const trackIds = useMemo(() => localTracks.map((track) => track.id), [localTracks]);

  const handleRemoveTrack = useCallback(
    async (trackId: string) => {
      const track = localTracks.find((t) => t.track?.id === trackId);

      const trackName = `${track?.track?.title} by ${track?.track?.artist}`;
      setRemovingTrackId(trackId);
      try {
        await removeTrackMutation.mutateAsync({
          playlistId: playlist?.id || '',
          trackId,
          artist: track?.track?.artist || '',
          title: track?.track?.title || '',
        });
        toast.success(`Track removed from playlist`, {
          description: capitalizeEveryWord(trackName),
          action: {
            label: 'Undo',
            onClick: () => {
              addTrackToPlaylist(trackId, track?.track?.artist || '', track?.track?.title || '');
            },
          },
        });
        onUpdate();
      } catch (error) {
        console.error('Failed to remove track:', error);
        toast.error('Could not remove that track. Please try again.');
      } finally {
        setRemovingTrackId(null);
      }
    },
    [localTracks, playlist?.id, removeTrackMutation, addTrackToPlaylist, onUpdate],
  );

  // Optimistically applies `newTracks`, persists the resulting positions, and
  // rolls back to `previousTracks` on failure. Shared by drag-and-drop and
  // Automix so both go through one save/rollback path.
  const persistReorder = useCallback(
    async (newTracks: PlaylistTrack[], previousTracks: PlaylistTrack[]) => {
      setLocalTracks(newTracks);
      try {
        if (!playlist?.id || !playlist?.tracks?.length) return false;
        const sortingOrder = playlist.sorting?.sortingDirection === 'asc' ? 1 : -1;
        const initialPosition = sortingOrder > 0 ? 0 : playlist.tracks.length;
        const positions = newTracks.map((track, index) => ({
          id: track.id,
          position: sortingOrder > 0 ? index + 1 : initialPosition - index,
        }));
        await updatePositionsMutation.mutateAsync({
          playlistId: playlist.id,
          positions,
        });
        onUpdate();
        return true;
      } catch (error) {
        console.error('Failed to update playlist positions:', error);
        toast.error('Could not save the new order. Reverting.');
        setLocalTracks(previousTracks);
        return false;
      }
    },
    [playlist, updatePositionsMutation, onUpdate],
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active || !over || active.id !== over.id) {
      const oldIndex = trackIds.indexOf(active.id as string);
      const newIndex = trackIds.indexOf(over?.id as string);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newTracks = arrayMove(localTracks, oldIndex, newIndex);
        await persistReorder(newTracks, localTracks);
      }
    }
  };

  const runAutomix = useCallback(
    async (seedTrackId?: string) => {
      if (!playlist?.id) return;
      const previous = localTracks;
      let reordered: PlaylistTrack[];
      try {
        reordered = await backendAutomixMutation.mutateAsync({
          playlistId: playlist.id,
          seedTrackId,
        });
      } catch (error) {
        console.error('Backend automix failed:', error);
        toast.error('Could not compute automix order. Please try again.');
        return;
      }
      const changed = reordered.some((track, index) => track.id !== previous[index]?.id);
      if (!changed) {
        toast.info('Already in optimal order');
        return;
      }
      const ok = await persistReorder(reordered, previous);
      if (ok) {
        toast.success('Reordered by Automix', {
          action: {
            label: 'Undo',
            onClick: () => {
              void persistReorder(previous, reordered);
            },
          },
        });
      }
    },
    [localTracks, persistReorder, backendAutomixMutation, playlist?.id],
  );

  useImperativeHandle(
    handleRef,
    () => ({ scrollToPosition: flashRow, runAutomix }),
    [flashRow, runAutomix],
  );

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="p-0" ref={listRef}>
        <PlaylistLedgerHeader />
        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <SortableContext items={trackIds} strategy={verticalListSortingStrategy}>
            <div className="divide-y" role="list" aria-label="Tracks in this playlist">
              {!isLoading && localTracks.length > 0
                ? localTracks.map((playlistTrack, index) => (
                    <SortablePlaylistTrack
                      key={playlistTrack.id}
                      playlistTrack={playlistTrack}
                      prevTrack={index > 0 ? localTracks[index - 1]?.track ?? null : null}
                      onRemove={handleRemoveTrack}
                      onAutomixFrom={runAutomix}
                      removingTrackId={removingTrackId}
                      index={index}
                      playlistLength={localTracks.length}
                    />
                  ))
                : Array.from({ length: 6 }).map((_, i) => (
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
  prevTrack,
  onRemove,
  onAutomixFrom,
  removingTrackId,
  index,
  playlistLength,
}: {
  playlistTrack: PlaylistTrack;
  prevTrack?: Track | null;
  onRemove: (trackId: string) => void;
  onAutomixFrom: (seedTrackId: string) => void;
  removingTrackId: string | null;
  index: number;
  playlistLength: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: playlistTrack.id,
  });

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }),
    [transform, transition, isDragging],
  );

  // Stable object identity so the memo() on PlaylistTrackListCard isn't
  // defeated by a fresh spread on every render of the list.
  const dragHandleProps = useMemo(
    () => ({ ...attributes, ...listeners }),
    [attributes, listeners],
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`track-${playlistTrack.position}`}
      role="listitem"
      data-track-row
      data-position={playlistTrack.position}
      className="scroll-mt-4"
    >
      <PlaylistTrackListCard
        playlistTrack={playlistTrack}
        prevTrack={prevTrack}
        handleRemoveTrack={onRemove}
        onAutomixFrom={onAutomixFrom}
        removingTrackId={removingTrackId}
        dragHandleProps={dragHandleProps}
        index={index}
        playlistLength={playlistLength}
      />
    </div>
  );
}
