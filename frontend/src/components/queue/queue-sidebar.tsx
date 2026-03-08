"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useQueue, useResetQueue } from "@/services/queue-hooks";
import { RefreshCcwIcon } from "lucide-react";
import { MUSIC_PLAYER_HEIGHT } from "../player/enhanced-music-player";
import { Button } from "../ui/button";
import { QueueList } from "./queue-list";

interface QueueDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QueueDrawer({ open, onOpenChange }: QueueDrawerProps) {
  const { data: queueItems = [] } = useQueue();
  const resetQueueMutation = useResetQueue();
  const handleResetQueue = () => {
    resetQueueMutation.mutate();
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0  "
        onInteractOutside={(e) => e.preventDefault()}
        style={
          {
            "--music-player-height": MUSIC_PLAYER_HEIGHT,
          } as React.CSSProperties
        }
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex flex-row items-center justify-between align-middle">
            Queue
            {queueItems.length > 0 && (
              <div className="flex flex-row  w-full items-center gap-2">
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({queueItems.length})
                </span>
                                <Button
                                  variant="ghost"
                                  size="iconSm"
                                  onClick={handleResetQueue}
                                  aria-label="Clear queue"
                                >
                                  <RefreshCcwIcon className="h-4 w-4" aria-hidden />
                                </Button>
              </div>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Playback queue with drag-and-drop reordering
          </SheetDescription>
        </SheetHeader>
        <div className="pb-38 h-full overflow-y-auto overscroll-contain p-4">
          <QueueList />
        </div>
      </SheetContent>
    </Sheet>
  );
}
