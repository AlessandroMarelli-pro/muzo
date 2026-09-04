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
import { ChevronDown, FunnelX, SlidersHorizontal, X } from 'lucide-react';
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
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full justify-between gap-1.5 font-normal"
        >
          <span className="flex items-center gap-1.5 truncate">
            {title}
            {selectedLabels.length > 0 && (
              <Badge
                variant="secondary"
                size="xs"
                className="rounded-full px-1.5 font-normal"
              >
                {selectedLabels.length === 1 ? selectedLabels[0] : selectedLabels.length}
              </Badge>
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
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
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full justify-between gap-1.5 font-normal"
        >
          <span className="flex items-center gap-1.5 truncate">
            {title}
            {isActive && (
              <Badge
                variant="secondary"
                size="xs"
                className="rounded-full px-1.5 font-mono font-normal"
              >
                {fmt(value.min)}–{fmt(value.max)}
              </Badge>
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
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

/** One removable summary of an active facet, shown in the chip strip under the bar. */
function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full border bg-card pl-2 pr-1 text-xs text-card-foreground">
      <span className="max-w-[16rem] truncate capitalize">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

interface TrackFilterBarProps {
  className?: string;
  /** Live count of tracks matching the current filters, shown next to the toolbar. */
  matchCount?: number;
  /** Extra controls rendered after the search field (e.g. a review toggle). */
  trailing?: React.ReactNode;
}

/**
 * The reusable filter toolbar. Only the artist/title search sits on the bar at
 * rest; every facet lives behind a single "Filters" popover so the toolbar
 * stays one row tall. Active facets surface as removable chips beneath it, so a
 * filtered view still shows exactly what's applied. Writes straight to the
 * shared FilterContext, so filtering behaves identically on every track screen.
 */
export function TrackFilterBar({ className, matchCount, trailing }: TrackFilterBarProps) {
  const { filters, updateFilter, resetFilters, hasActiveFilters } = useFilters();
  const options = useFilterOptionsData();
  const [panelOpen, setPanelOpen] = React.useState(false);

  const [artist, setArtist] = React.useState(filters.artist);
  const [title, setTitle] = React.useState(filters.title);

  React.useEffect(() => setArtist(filters.artist), [filters.artist]);
  React.useEffect(() => setTitle(filters.title), [filters.title]);

  const pushArtist = useDebouncedCallback((v: string) => updateFilter('artist', v), 300);
  const pushTitle = useDebouncedCallback((v: string) => updateFilter('title', v), 300);

  const labelFor = (opts: Option[], value: string) =>
    opts.find((o) => o.value === value)?.label ?? value;

  // Everything filterable that isn't the free-text search. Order matches the panel.
  const multiFacets = [
    { key: 'genres' as const, title: 'Genre', opts: options.genres },
    { key: 'subgenres' as const, title: 'Subgenre', opts: options.subgenres },
    { key: 'library' as const, title: 'Library', opts: options.libraries },
    { key: 'keyIds' as const, title: 'Key', opts: options.keys },
    { key: 'arousalMood' as const, title: 'Energy', opts: arousalMoodOptions },
    { key: 'valenceMood' as const, title: 'Valence', opts: valenceMoodOptions },
    {
      key: 'danceabilityFeeling' as const,
      title: 'Danceability',
      opts: danceabilityFeelingOptions,
    },
  ];
  const rangeFacets = [
    {
      key: 'tempo' as const,
      title: 'BPM',
      defaultRange: { min: 0, max: 200 },
      step: 1,
      format: (n: number) => String(n),
    },
    {
      key: 'instrumentalness' as const,
      title: 'Instrumentalness',
      defaultRange: { min: 0, max: 1 },
      step: 0.05,
      format: (n: number) => n.toFixed(2),
    },
  ];

  const activeFacetCount =
    multiFacets.reduce((n, f) => n + (filters[f.key].length > 0 ? 1 : 0), 0) +
    rangeFacets.reduce(
      (n, f) =>
        n +
        (filters[f.key].min !== f.defaultRange.min ||
        filters[f.key].max !== f.defaultRange.max
          ? 1
          : 0),
      0,
    );

  const chips: { id: string; label: string; onRemove: () => void }[] = [];
  for (const f of multiFacets) {
    for (const value of filters[f.key]) {
      chips.push({
        id: `${f.key}:${value}`,
        label: `${f.title}: ${labelFor(f.opts, value)}`,
        onRemove: () =>
          updateFilter(
            f.key,
            filters[f.key].filter((v) => v !== value),
          ),
      });
    }
  }
  for (const f of rangeFacets) {
    const r = filters[f.key];
    if (r.min !== f.defaultRange.min || r.max !== f.defaultRange.max) {
      chips.push({
        id: f.key,
        label: `${f.title}: ${f.format(r.min)}–${f.format(r.max)}`,
        onRemove: () => updateFilter(f.key, f.defaultRange),
      });
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
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

        <Popover open={panelOpen} onOpenChange={setPanelOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {activeFacetCount > 0 && (
                <Badge
                  variant="secondary"
                  size="xs"
                  className="rounded-full px-1.5 font-normal tabular-nums"
                >
                  {activeFacetCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60 p-0">
            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
              <FacetGroup label="Catalog">
                {multiFacets.slice(0, 3).map((f) => (
                  <FacetFilter
                    key={f.key}
                    title={f.title}
                    options={f.opts}
                    selected={filters[f.key]}
                    onChange={(next) => updateFilter(f.key, next)}
                  />
                ))}
              </FacetGroup>

              <FacetGroup label="Musical">
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
                <RangeFilter
                  title="Instrumentalness"
                  value={filters.instrumentalness}
                  defaultRange={{ min: 0, max: 1 }}
                  step={0.05}
                  format={(n) => n.toFixed(2)}
                  onChange={(next) => updateFilter('instrumentalness', next)}
                />
              </FacetGroup>

              <FacetGroup label="Mood">
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
              </FacetGroup>
            </div>

            {hasActiveFilters && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-1.5 text-muted-foreground"
                  onClick={resetFilters}
                >
                  <FunnelX className="h-3.5 w-3.5" />
                  Clear all filters
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {trailing}

        {hasActiveFilters && matchCount !== undefined && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {matchCount.toLocaleString()} match{matchCount === 1 ? '' : 'es'}
          </span>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <ActiveChip key={c.id} label={c.label} onRemove={c.onRemove} />
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="ml-0.5 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

/** A titled column of facet controls inside the Filters panel. */
function FacetGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="grid gap-1.5">{children}</div>
    </div>
  );
}
