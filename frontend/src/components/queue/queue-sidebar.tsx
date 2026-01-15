'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useQueue } from '@/services/queue-hooks';
import { QueueList } from './queue-list';

interface QueueDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QueueDrawer({ open, onOpenChange }: QueueDrawerProps) {
  const { data: queueItems = [] } = useQueue();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 z-[9998]">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>
            Queue
            {queueItems.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({queueItems.length})
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Playback queue with drag-and-drop reordering
          </SheetDescription>
        </SheetHeader>
        <div className="h-[calc(100vh-5rem)] overflow-y-auto p-4">
          <QueueList />
        </div>
      </SheetContent>
    </Sheet>
  );
}
