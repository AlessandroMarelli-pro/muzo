'use client';

import { Button } from '@/components/ui/button';
import { Flame, Heart, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <div className="flex items-center justify-center gap-4 mt-8">
      <Button
        size="lg"
        variant="outline"
        className={cn(
          'h-16 w-16 rounded-full border-2 border-red-500 hover:bg-red-500 hover:text-white',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        onClick={onDislike}
        disabled={disabled}
      >
        <X className="h-8 w-8" />
      </Button>

      <Button
        size="lg"
        variant="outline"
        className={cn(
          'h-20 w-20 rounded-full border-2 border-orange-500 hover:bg-orange-500 hover:text-white',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        onClick={onBanger}
        disabled={disabled}
      >
        <Flame className="h-10 w-10" />
      </Button>

      <Button
        size="lg"
        variant="outline"
        className={cn(
          'h-16 w-16 rounded-full border-2 border-green-500 hover:bg-green-500 hover:text-white',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        onClick={onLike}
        disabled={disabled}
      >
        <Heart className="h-8 w-8" />
      </Button>
    </div>
  );
}
