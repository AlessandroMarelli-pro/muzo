import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import * as React from 'react';

interface SearchInputProps extends Omit<React.ComponentProps<'input'>, 'onChange' | 'value'> {
  value: string;
  /** Receives the raw string — every call site unwrapped `e.target.value` anyway. */
  onValueChange: (value: string) => void;
}

/**
 * Search field with a leading icon, shared by the list/table screens.
 * Uses `text-muted-foreground` rather than a hardcoded gray so it reads
 * correctly in dark mode.
 */
function SearchInput({
  value,
  onValueChange,
  placeholder = 'Search…',
  className,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <Search
        className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-label={typeof placeholder === 'string' ? placeholder : 'Search'}
        className="pl-9"
        {...props}
      />
    </div>
  );
}

export { SearchInput };
