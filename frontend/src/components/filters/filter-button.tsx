import { FilterSheet } from '@/components/filters';
import { Badge } from '@/components/ui/badge';
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

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const handleClearFilters = (e: React.MouseEvent) => {
    e.stopPropagation();
    resetFilters();
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className={`relative ${className}`}
      >
        <ListFilter className="h-4 w-4 mr-2" />
        Filters
        {hasActiveFilters && (
          <Badge
            variant="secondary"
            className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center"
          >
            <X
              className="h-3 w-3"
              onClick={handleClearFilters}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleClearFilters(e as any);
                }
              }}
            />
          </Badge>
        )}
      </Button>

      <FilterSheet open={isOpen} onOpenChange={handleOpenChange} />
    </>
  );
}
