'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useQueue, useResetQueue } from '@/services/queue-hooks';
import { RefreshCcwIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { QueueList } from './queue-list';

interface QueueDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Height in px of the fixed player bar this drawer should sit above. */
  offsetBottom?: number;
}

export function QueueDrawer({
  open,
  onOpenChange,
  offsetBottom = 0,
}: QueueDrawerProps) {
  const { data: queueItems = [] } = useQueue();
  const resetQueueMutation = useResetQueue();
  const handleResetQueue = () => {
    resetQueueMutation.mutate();
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="w-full sm:max-w-lg max-h-[75vh] rounded-tl-2xl border-l p-0 flex flex-col"
        style={
          {
            left: 'auto',
            right: 0,
            bottom: offsetBottom,
          } as React.CSSProperties
        }
      >
        <SheetHeader className="border-b px-6 py-4 shrink-0">
          <SheetTitle className="flex flex-row items-center justify-between align-middle">
            Queue
            {queueItems.length > 0 && (
              <div className="flex flex-row  w-full items-center gap-2">
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({queueItems.length})
                </span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="iconSm"
                      aria-label="Clear queue"
                    >
                      <RefreshCcwIcon className="h-4 w-4" aria-hidden />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear the queue?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes all {queueItems.length} track
                        {queueItems.length === 1 ? '' : 's'} from the queue.
                        This can't be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetQueue}>
                        Clear queue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Playback queue with drag-and-drop reordering
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <QueueList />
        </div>
      </SheetContent>
    </Sheet>
  );
}
