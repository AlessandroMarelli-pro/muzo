import { Loading } from '@/components/loading';
import {
  QueueItem,
  useQueue,
  useRemoveTrackFromQueue,
  useUpdateQueuePositions,
} from '@/services/queue-hooks';
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
import { useEffect, useMemo, useState } from 'react';
import { QueueItemCard } from './queue-item-card';

export function QueueList() {
  const { data: queueItems = [], isLoading, error } = useQueue();
  const removeTrackMutation = useRemoveTrackFromQueue();
  const updatePositionsMutation = useUpdateQueuePositions();
  const [removingTrackId, setRemovingTrackId] = useState<string | null>(null);
  const [localQueue, setLocalQueue] = useState<QueueItem[]>(queueItems);

  // Update local queue when server queue changes
  useEffect(() => {
    setLocalQueue(queueItems);
  }, [queueItems]);

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  const queueIds = useMemo(() => localQueue.map((item) => item.id), [localQueue]);

  const handleRemoveTrack = async (trackId: string) => {
    setRemovingTrackId(trackId);
    try {
      await removeTrackMutation.mutateAsync(trackId);
    } catch (err) {
      console.error('Failed to remove track:', err);
    } finally {
      setRemovingTrackId(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active || !over || active.id !== over.id) {
      const oldIndex = queueIds.indexOf(active.id as string);
      const newIndex = queueIds.indexOf(over?.id as string);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Optimistically update local state
        const newQueue = arrayMove(localQueue, oldIndex, newIndex);
        setLocalQueue(newQueue);

        // Update positions in backend
        try {
          const positions = newQueue.map((item, index) => ({
            trackId: item.trackId,
            position: index + 1,
          }));
          await updatePositionsMutation.mutateAsync(positions);
        } catch (err) {
          console.error('Failed to update queue positions:', err);
          // Revert on error
          setLocalQueue(queueItems);
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-12 text-center text-sm text-destructive">
        Couldn't load the queue — {error.message}
      </div>
    );
  }

  if (localQueue.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
        <Clock className="size-8 text-muted-foreground/60" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">Queue is empty</h3>
        <p className="text-xs text-muted-foreground">Add tracks and they'll line up here.</p>
      </div>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <SortableContext items={queueIds} strategy={verticalListSortingStrategy}>
        <div className="divide-y divide-border/60">
          {localQueue.map((queueItem, index) => (
            <SortableQueueItem
              key={queueItem.id}
              queueItem={queueItem}
              index={index}
              onRemove={handleRemoveTrack}
              removingTrackId={removingTrackId}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableQueueItem({
  queueItem,
  index,
  onRemove,
  removingTrackId,
}: {
  queueItem: QueueItem;
  index: number;
  onRemove: (trackId: string) => void;
  removingTrackId: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: queueItem.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <QueueItemCard
        queueItem={queueItem}
        index={index}
        onRemove={onRemove}
        removingTrackId={removingTrackId}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  );
}
