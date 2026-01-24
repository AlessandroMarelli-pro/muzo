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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  placeholder = 'Select items...',
  className,
  isLoading = false,
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
      <Popover open={open} onOpenChange={setOpen} modal={false} >
        <PopoverTrigger
          className={cn(
            'flex h-8 w-full  items-center justify-between rounded-md border border-input bg-background text-sm ',
            'focus:outline-none ',
            'disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
            'hover:bg-accent hover:text-accent-foreground',
          )}
          disabled={disabled}
          aria-expanded={open}
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
                <span className="text-muted-foreground truncate">
                  {placeholder}
                </span>
              ) : (
                value.map((item) => {
                  const option = options?.find((opt) => opt.value === item);
                  return (
                    <Badge key={item} variant="default" className="text-xs cursor-pointer " size="xs" onClick={(e) => {
                      e.stopPropagation();
                      handleUnselect(item);
                    }}
                    >
                      <div className="flex flex-row items-center gap-1 align-middle">
                        {option?.label}
                        <X className="size-3" />

                      </div>
                    </Badge>
                  );
                })
              )}
            </div>
            <hr className="border-l border-border bg-red-300 h-6 mx-0.5 my-auto" />
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((prev) => !prev);
              }}
              tabIndex={0}
              className={cn(
                'p-1 mx-1.5 my-auto h-full outline-none',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'hover:bg-accent/50 rounded-sm cursor-pointer',
              )}
            >
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </span>
          </div>
        </PopoverTrigger>
        <PopoverContent
          onWheel={(e) => {
            e.stopPropagation();
          }}
          className="w-full p-0 z-[9999] max-h-[200px] overflow-y-auto" align="start">
          <Command>
            <CommandInput autoFocus={false} placeholder="Search items..." />
            <ScrollArea className="max-h-[200px] overflow-y-auto">
              <CommandList className="max-h-[200px] overflow-y-auto">
                <CommandEmpty className="p-0">
                  No items found.

                </CommandEmpty>
                <CommandGroup>

                  {options?.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={(selectedValue) => {
                        handleSelect(selectedValue);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value.includes(option.value)
                            ? 'opacity-100'
                            : 'opacity-0',
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
