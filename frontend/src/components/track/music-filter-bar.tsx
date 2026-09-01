import { FilterButton } from '@/components/filters/filter-button';
import {
  arousalMoodOptions,
} from '@/components/track/track-feature-options';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SearchInput } from '@/components/ui/search-input';
import { Slider } from '@/components/ui/slider';
import { Toggle } from '@/components/ui/toggle';
import { useFilters } from '@/contexts/filter-context';
import { useFilterOptionsData } from '@/hooks/useFilterOptions';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { cn } from '@/lib/utils';
import { CheckIcon } from '@radix-ui/react-icons';
import { ChevronDown, Sparkles } from 'lucide-react';
import * as React from 'react';

interface Option {
  label: string;
  value: string;
}

/** A single inline multi-select facet ("Genre", "Key", "Energy"). */
function FacetFilter({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedSet = new Set(selected);
  const selectedLabels = options
    .filter((o) => selectedSet.has(o.value))
    .map((o) => o.label);

  const toggle = (value: string) => {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange([...next]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {title}
          {selectedLabels.length > 0 && (
            <Badge variant="secondary" size="xs" className="rounded-full px-1.5 font-normal">
              {selectedLabels.length === 1 ? selectedLabels[0] : selectedLabels.length}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Filter ${title.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-y-auto">
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value);
                return (
                  <CommandItem key={option.value} onSelect={() => toggle(option.value)}>
                    <div
                      className={cn(
                        'mr-2 flex size-4 items-center justify-center rounded-sm border border-primary',
                        isSelected ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible',
                      )}
                    >
                      <CheckIcon className="size-3" />
                    </div>
                    <span className="truncate capitalize">{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.length > 0 && (
              <CommandGroup className="border-t">
                <CommandItem
                  onSelect={() => onChange([])}
                  className="justify-center text-center text-muted-foreground"
                >
                  Clear
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** BPM range popover. */
function TempoFilter({
  value,
  onChange,
}: {
  value: { min: number; max: number };
  onChange: (next: { min: number; max: number }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [local, setLocal] = React.useState<[number, number]>([value.min, value.max]);

  React.useEffect(() => {
    setLocal([value.min, value.max]);
  }, [value.min, value.max]);

  const isActive = value.min !== 0 || value.max !== 200;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          BPM
          {isActive && (
            <Badge variant="secondary" size="xs" className="rounded-full px-1.5 font-normal font-mono">
              {value.min}–{value.max}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3" align="start">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Tempo</span>
          <span className="font-mono text-muted-foreground">
            {local[0]} – {local[1]} BPM
          </span>
        </div>
        <Slider
          min={0}
          max={200}
          step={1}
          value={local}
          onValueChange={(v) => setLocal([v[0], v[1]])}
          onValueCommit={(v) => onChange({ min: v[0], max: v[1] })}
        />
        {isActive && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => onChange({ min: 0, max: 200 })}
          >
            Reset
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface MusicFilterBarProps {
  reviewMode: boolean;
  pendingCount: number;
  onReviewChange: (next: boolean) => void;
}

/**
 * The compact filter row for the Music views: one search field, the four
 * filters a DJ reaches for constantly (Genre, BPM, Key, Energy), an
 * "All filters" button, and a "Needs review" toggle that swaps the list to
 * tracks still awaiting analysis. Writes straight to the shared FilterContext.
 * In review mode the facets are hidden — they don't apply to the pending query.
 */
export function MusicFilterBar({ reviewMode, pendingCount, onReviewChange }: MusicFilterBarProps) {
  const { filters, updateFilter } = useFilters();
  const options = useFilterOptionsData();

  const [artist, setArtist] = React.useState(filters.artist);
  const [title, setTitle] = React.useState(filters.title);

  React.useEffect(() => setArtist(filters.artist), [filters.artist]);
  React.useEffect(() => setTitle(filters.title), [filters.title]);

  const pushArtist = useDebouncedCallback((v: string) => updateFilter('artist', v), 300);
  const pushTitle = useDebouncedCallback((v: string) => updateFilter('title', v), 300);

  const reviewToggle = (pendingCount > 0 || reviewMode) && (
    <Toggle
      pressed={reviewMode}
      onPressedChange={onReviewChange}
      variant="outline"
      size="sm"
      className="gap-1.5"
      aria-label="Show only tracks that need review"
    >
      <Sparkles className="h-3.5 w-3.5" />
      Needs review
      {pendingCount > 0 && (
        <Badge variant="secondary" size="xs" className="rounded-full px-1.5 font-normal">
          {pendingCount.toLocaleString()}
        </Badge>
      )}
    </Toggle>
  );

  if (reviewMode) {
    return <div className="flex flex-wrap items-center gap-2">{reviewToggle}</div>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-[12rem] flex-1 gap-2 sm:max-w-md">
        <SearchInput
          value={artist}
          onValueChange={(v) => {
            setArtist(v);
            pushArtist(v);
          }}
          placeholder="Artist"
        />
        <SearchInput
          value={title}
          onValueChange={(v) => {
            setTitle(v);
            pushTitle(v);
          }}
          placeholder="Title"
        />
      </div>

      <FacetFilter
        title="Genre"
        options={options.genres}
        selected={filters.genres}
        onChange={(next) => updateFilter('genres', next)}
      />
      <FacetFilter
        title="Subgenre"
        options={options.subgenres}
        selected={filters.subgenres}
        onChange={(next) => updateFilter('subgenres', next)}
      />
      <TempoFilter value={filters.tempo} onChange={(next) => updateFilter('tempo', next)} />
      <FacetFilter
        title="Key"
        options={options.keys}
        selected={filters.keyIds}
        onChange={(next) => updateFilter('keyIds', next)}
      />
      <FacetFilter
        title="Energy"
        options={arousalMoodOptions}
        selected={filters.arousalMood}
        onChange={(next) => updateFilter('arousalMood', next)}
      />

      <FilterButton />
      {reviewToggle}
    </div>
  );
}
