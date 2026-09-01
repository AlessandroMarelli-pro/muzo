import {
  arousalMoodOptions,
  danceabilityFeelingOptions,
  valenceMoodOptions,
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
import { useFilters } from '@/contexts/filter-context';
import { useFilterOptionsData } from '@/hooks/useFilterOptions';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { cn } from '@/lib/utils';
import { CheckIcon } from '@radix-ui/react-icons';
import { ChevronDown, FunnelX } from 'lucide-react';
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

/** A numeric range popover ("BPM", "Instrumentalness"). Commits on release, not per drag tick. */
function RangeFilter({
  title,
  value,
  defaultRange,
  step,
  format,
  onChange,
}: {
  title: string;
  value: { min: number; max: number };
  defaultRange: { min: number; max: number };
  step: number;
  format?: (n: number) => string;
  onChange: (next: { min: number; max: number }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [local, setLocal] = React.useState<[number, number]>([value.min, value.max]);

  React.useEffect(() => {
    setLocal([value.min, value.max]);
  }, [value.min, value.max]);

  const isActive = value.min !== defaultRange.min || value.max !== defaultRange.max;
  const fmt = format ?? ((n: number) => String(n));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {title}
          {isActive && (
            <Badge variant="secondary" size="xs" className="rounded-full px-1.5 font-normal font-mono">
              {fmt(value.min)}–{fmt(value.max)}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3" align="start">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{title}</span>
          <span className="font-mono text-muted-foreground">
            {fmt(local[0])} – {fmt(local[1])}
          </span>
        </div>
        <Slider
          min={defaultRange.min}
          max={defaultRange.max}
          step={step}
          value={local}
          onValueChange={(v) => setLocal([v[0], v[1]])}
          onValueCommit={(v) => onChange({ min: v[0], max: v[1] })}
        />
        {isActive && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => onChange(defaultRange)}
          >
            Reset
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface TrackFilterBarProps {
  className?: string;
  /** Live count of tracks matching the current filters, shown next to the toolbar. */
  matchCount?: number;
  /** Extra controls rendered after the filter facets (e.g. a review toggle). */
  trailing?: React.ReactNode;
}

/**
 * The reusable filter toolbar: search plus every filterable facet as an
 * inline, non-modal popover. Writes straight to the shared FilterContext.
 * Used by every track-listing screen (Music, Swipe, Pending) so filtering
 * behaves identically everywhere.
 */
export function TrackFilterBar({ className, matchCount, trailing }: TrackFilterBarProps) {
  const { filters, updateFilter, resetFilters, hasActiveFilters } = useFilters();
  const options = useFilterOptionsData();

  const [artist, setArtist] = React.useState(filters.artist);
  const [title, setTitle] = React.useState(filters.title);

  React.useEffect(() => setArtist(filters.artist), [filters.artist]);
  React.useEffect(() => setTitle(filters.title), [filters.title]);

  const pushArtist = useDebouncedCallback((v: string) => updateFilter('artist', v), 300);
  const pushTitle = useDebouncedCallback((v: string) => updateFilter('title', v), 300);

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
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
      <RangeFilter
        title="BPM"
        value={filters.tempo}
        defaultRange={{ min: 0, max: 200 }}
        step={1}
        onChange={(next) => updateFilter('tempo', next)}
      />
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
      <FacetFilter
        title="Valence"
        options={valenceMoodOptions}
        selected={filters.valenceMood}
        onChange={(next) => updateFilter('valenceMood', next)}
      />
      <FacetFilter
        title="Danceability"
        options={danceabilityFeelingOptions}
        selected={filters.danceabilityFeeling}
        onChange={(next) => updateFilter('danceabilityFeeling', next)}
      />
      <RangeFilter
        title="Instrumentalness"
        value={filters.instrumentalness}
        defaultRange={{ min: 0, max: 1 }}
        step={0.05}
        format={(n) => n.toFixed(2)}
        onChange={(next) => updateFilter('instrumentalness', next)}
      />
      <FacetFilter
        title="Library"
        options={options.libraries}
        selected={filters.library}
        onChange={(next) => updateFilter('library', next)}
      />

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={resetFilters}>
          <FunnelX className="h-3.5 w-3.5" />
          Clear filters
        </Button>
      )}

      {hasActiveFilters && matchCount !== undefined && (
        <span className="text-muted-foreground text-xs">
          {matchCount.toLocaleString()} match{matchCount === 1 ? '' : 'es'}
        </span>
      )}

      {trailing}
    </div>
  );
}
