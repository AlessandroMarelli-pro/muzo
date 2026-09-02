'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import * as React from 'react';

interface MultiSelectProps {
  options?: { label: string; value: string }[];
  value: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  isLoading?: boolean;
  disabled?: boolean;
  id?: string;
  'aria-labelledby'?: string;
}

/**
 * Multi-select combobox. Deliberately does NOT use Radix Popover — it renders
 * the panel inline (no portal) so it works correctly inside a Radix Dialog /
 * Sheet, where a portalled popover's focus scope fights the dialog's and the
 * search field becomes unusable.
 */
export default function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select items…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matches.',
  className,
  isLoading: _isLoading = false,
  disabled = false,
  id,
  'aria-labelledby': ariaLabelledby,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listboxId = React.useId();

  const toggle = (item: string) =>
    onChange(value.includes(item) ? value.filter((i) => i !== item) : [...value, item]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = options ?? [];
    return q ? all.filter((o) => o.label.toLowerCase().includes(q)) : all;
  }, [options, search]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [search]);

  // Focus the search field once the panel has actually mounted.
  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close on outside pointerdown / Escape.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const openPanel = () => {
    if (disabled) return;
    setOpen(true);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      openPanel();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) toggle(opt.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Backspace' && !search && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <div
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-labelledby={ariaLabelledby}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={openPanel}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          'flex min-h-9 w-full items-center justify-between gap-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          open && 'ring-1 ring-ring',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        )}
      >
        <div className="flex flex-1 flex-wrap items-center gap-1 overflow-hidden">
          {value.length === 0 ? (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          ) : (
            value.map((item) => {
              const option = options?.find((opt) => opt.value === item);
              return (
                <Badge key={item} variant="default" size="xs" className="gap-1 pr-1" asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(item);
                    }}
                    aria-label={`Remove ${option?.label ?? item}`}
                    className="flex cursor-pointer items-center gap-1"
                  >
                    {option?.label ?? item}
                    <X className="size-3" />
                  </button>
                </Badge>
              );
            })
          )}
        </div>
        <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
      </div>

      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="flex h-9 items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 opacity-50" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={searchPlaceholder}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-autocomplete="list"
              aria-controls={listboxId}
              className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ul
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            className="max-h-[220px] overflow-y-auto p-1"
          >
            {filtered.length === 0 ? (
              <li className="py-4 text-center text-sm text-muted-foreground">{emptyMessage}</li>
            ) : (
              filtered.map((option, i) => {
                const selected = value.includes(option.value);
                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={selected}
                    onPointerDown={(e) => {
                      e.preventDefault(); // keep focus in the input
                      toggle(option.value);
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                      i === activeIndex && 'bg-accent text-accent-foreground',
                    )}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0 text-primary',
                        selected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
