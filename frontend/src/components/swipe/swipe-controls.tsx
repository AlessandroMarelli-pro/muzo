'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Flame, ThumbsDown, ThumbsUp } from 'lucide-react';

interface SwipeControlsProps {
  onLike: () => void;
  onDislike: () => void;
  onBanger: () => void;
  disabled?: boolean;
}

export function SwipeControls({
  onLike,
  onDislike,
  onBanger,
  disabled = false,
}: SwipeControlsProps) {
  return (
    <div className="flex flex-row items-center justify-center gap-4 mt-8">
      <Button
        size="icon"
        variant="destructive"
        className={cn(
          'border-none text-white ',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        onClick={onDislike}
        disabled={disabled}
      >
        <ThumbsDown />
      </Button>

      <Button
        size="icon"
        variant="default"
        className={cn(
          'border-none text-white bg-orange-500 hover:bg-orange-500/80',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        onClick={onBanger}
        disabled={disabled}
      >
        <Flame className="h-10 w-10" />
      </Button>

      <Button
        size="icon"
        variant="default"
        className={cn(
          'border-none text-white ',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        onClick={onLike}
        disabled={disabled}
      >
        <ThumbsUp className="h-8 w-8" />
      </Button>
    </div>
  );
}
