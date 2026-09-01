import { FilterSheet } from '@/components/filters/filter-sheet';
import { Button } from '@/components/ui/button';
import { useFilters } from '@/contexts/filter-context';
import { ListFilter, X } from 'lucide-react';
import { useState } from 'react';

interface FilterButtonProps {
  className?: string;
}

export function FilterButton({ className }: FilterButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { hasActiveFilters, resetFilters } = useFilters();

  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <ListFilter className="h-4 w-4" />
        Filters
      </Button>
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="iconSm"
          aria-label="Clear all filters"
          onClick={resetFilters}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}

      <FilterSheet open={isOpen} onOpenChange={setIsOpen} />
    </div>
  );
}
