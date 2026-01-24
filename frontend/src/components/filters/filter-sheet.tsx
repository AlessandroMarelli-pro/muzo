import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { FilterComponent } from './filter-component';

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


export function FilterSheet({ open, onOpenChange }: FilterSheetProps) {
  const [isLoading, setIsLoading] = useState(false);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="sm:max-w-[500px] z-1000 overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Filter Tracks{' '}
            {isLoading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
          </SheetTitle>
          <SheetDescription>
            Filter your music collection by various criteria.
          </SheetDescription>
        </SheetHeader>

        <FilterComponent className="w-full" onLoadingChange={setIsLoading} />
      </SheetContent>
    </Sheet>
  );
}
