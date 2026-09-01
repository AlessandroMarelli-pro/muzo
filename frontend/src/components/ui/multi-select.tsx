'use client';

import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@radix-ui/react-scroll-area';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import * as React from 'react';

interface MultiSelectProps {
  options?: { label: string; value: string }[];
  value: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select items…',
  className,
  isLoading: _isLoading = false,
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleUnselect = (item: string) => {
    onChange(value.filter((i) => i !== item));
  };

  const handleSelect = (item: string) => {
    if (value.includes(item)) {
      handleUnselect(item);
    } else {
      onChange([...value, item]);
    }
    // Don't close the popover on selection for multi-select
    // setOpen(false);
  };

  return (
    <div className={cn('w-full', className)}>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild disabled={disabled}>
          <div
            role="combobox"
            aria-expanded={open}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onClick={() => !disabled && setOpen((prev) => !prev)}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOpen((prev) => !prev);
              }
            }}
            className={cn(
              'flex h-8 w-full  items-center justify-between rounded-md border border-input bg-background text-sm ',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
              'hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <div className="flex justify-between flex-1 overflow-hidden">
            <div
              className="flex gap-1 flex-1 py-2 px-3 overflow-x-auto"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'hsl(var(--border)) transparent',
              }}
            >
              {value.length === 0 ? (
                <span className="text-muted-foreground truncate">{placeholder}</span>
              ) : (
                value.map((item) => {
                  const option = options?.find((opt) => opt.value === item);
                  return (
                    <Badge key={item} variant="default" className="text-xs" size="xs" asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnselect(item);
                        }}
                        aria-label={`Remove ${option?.label ?? item}`}
                        className="flex cursor-pointer flex-row items-center gap-1 align-middle"
                      >
                        {option?.label}
                        <X className="size-3" />
                      </button>
                    </Badge>
                  );
                })
              )}
            </div>
            <hr className="border-l border-border h-6 mx-0.5 my-auto" />
            <span className="p-1 mx-1.5 my-auto h-full flex items-center" aria-hidden="true">
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </span>
          </div>
          </div>
        </PopoverTrigger>
        <PopoverContent
          onWheel={(e) => {
            e.stopPropagation();
          }}
          className="w-full p-0 z-[9999] max-h-[200px] overflow-y-auto"
          align="start"
        >
          <Command>
            <CommandInput autoFocus={false} placeholder="Search items…" />
            <ScrollArea className="max-h-[200px] overflow-y-auto">
              <CommandList className="max-h-[200px] overflow-y-auto">
                <CommandEmpty className="p-0">No items found.</CommandEmpty>
                <CommandGroup>
                  {options?.map((option) => (
                    <CommandItem
                      key={option.label}
                      value={option.label}
                      onSelect={() => {
                        handleSelect(option.value);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value.includes(option.value) ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </ScrollArea>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
