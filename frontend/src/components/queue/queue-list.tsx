import { Loading } from '@/components/loading';
import { Card, CardContent } from '@/components/ui/card';
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

  const queueIds = useMemo(
    () => localQueue.map((item) => item.id),
    [localQueue],
  );

  const handleRemoveTrack = async (trackId: string) => {
    setRemovingTrackId(trackId);
    try {
      await removeTrackMutation.mutateAsync(trackId);
    } catch (error) {
      console.error('Failed to remove track:', error);
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
        } catch (error) {
          console.error('Failed to update queue positions:', error);
          // Revert on error
          setLocalQueue(queueItems);
        }
      }
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Loading />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <div className="text-red-500">
            Error loading queue: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (localQueue.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <div className="space-y-4">
            <div className="text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Queue is empty</h3>
              <p>Add tracks to start building your queue</p>
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
            items={queueIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="divide-y">
              {localQueue.map((queueItem, index) => (
                <SortableQueueItem
                  key={queueItem.id}
                  queueItem={queueItem}
                  index={index}
                  onRemove={handleRemoveTrack}
                  removingTrackId={removingTrackId}
                  queueItemsCount={localQueue.length}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}

function SortableQueueItem({
  queueItem,
  index,
  onRemove,
  removingTrackId,
  queueItemsCount,
}: {
  queueItem: QueueItem;
  index: number;
  onRemove: (trackId: string) => void;
  removingTrackId: string | null;
  queueItemsCount: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
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
        queueItemsCount={queueItemsCount}
        onRemove={onRemove}
        removingTrackId={removingTrackId}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
