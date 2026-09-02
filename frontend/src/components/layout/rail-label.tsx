import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import * as React from 'react';

/**
 * The floating name pill shown to the right of a rail item on hover / focus.
 * Wraps the shared Tooltip primitive so keyboard focus reveals the label too.
 */
export function RailLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={10}
        className="rounded-md bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
