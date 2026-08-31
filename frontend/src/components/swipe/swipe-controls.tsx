'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Flame, ThumbsDown, ThumbsUp } from 'lucide-react';

interface SwipeControlsProps {
  onLike: () => void;
  onDislike: () => void;
  onBanger: () => void;
  disabled?: boolean;
  className?: string;
}

export function SwipeControls({
  onLike,
  onDislike,
  onBanger,
  disabled = false,
  className,
}: SwipeControlsProps) {
  return (
    <div className={cn('flex flex-row items-center justify-center gap-4 mt-8', className)}>
      <Button
        size="icon"
        variant="destructive"
        className={cn('border-none text-white ', disabled && 'opacity-50 cursor-not-allowed')}
        onClick={onDislike}
        disabled={disabled}
        aria-label="Dislike"
      >
        <ThumbsDown className="h-6 w-6" aria-hidden />
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
        aria-label="Banger"
      >
        <Flame className="h-10 w-10" aria-hidden />
      </Button>

      <Button
        size="icon"
        variant="default"
        className={cn('border-none text-white ', disabled && 'opacity-50 cursor-not-allowed')}
        onClick={onLike}
        disabled={disabled}
        aria-label="Like"
      >
        <ThumbsUp className="h-8 w-8" aria-hidden />
      </Button>
    </div>
  );
}
