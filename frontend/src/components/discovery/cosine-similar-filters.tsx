import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import type { CosineSimilarFilters } from '@/services/playlist-hooks';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';

type Range = { min: number; max: number };

const YEAR_RANGE: Range = { min: 1950, max: 2030 };
const HAVE_RANGE: Range = { min: 0, max: 500 };
const WANT_RANGE: Range = { min: 0, max: 500 };
const PRICE_RANGE: Range = { min: 0, max: 500 };

/** A numeric range popover, mirroring RangeFilter in track-filter-bar.tsx. Commits on release. */
function RangeControl({
  title,
  value,
  defaultRange,
  step,
  format,
  onChange,
}: {
  title: string;
  value: Range;
  defaultRange: Range;
  step: number;
  format?: (n: number) => string;
  onChange: (next: Range) => void;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<[number, number]>([value.min, value.max]);

  useEffect(() => {
    setLocal([value.min, value.max]);
  }, [value.min, value.max]);

  const isActive = value.min !== defaultRange.min || value.max !== defaultRange.max;
  const fmt = format ?? ((n: number) => String(n));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 justify-between gap-1.5 font-normal">
          <span className="flex items-center gap-1.5 truncate">
            {title}
            {isActive && (
              <Badge variant="secondary" size="xs" className="rounded-full px-1.5 font-mono font-normal">
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
          <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(defaultRange)}>
            Reset
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function filtersToRanges(filters: CosineSimilarFilters) {
  return {
    year: {
      min: filters.startYear ?? YEAR_RANGE.min,
      max: filters.endYear ?? YEAR_RANGE.max,
    },
    have: {
      min: filters.minHave ?? HAVE_RANGE.min,
      max: filters.maxHave ?? HAVE_RANGE.max,
    },
    want: {
      min: filters.minWant ?? WANT_RANGE.min,
      max: filters.maxWant ?? WANT_RANGE.max,
    },
    price: {
      min: filters.minPrice ?? PRICE_RANGE.min,
      max: filters.maxPrice ?? PRICE_RANGE.max,
    },
  };
}

interface CosineSimilarFiltersControlProps {
  filters: CosineSimilarFilters;
  onChange: (filters: CosineSimilarFilters) => void;
}

/** Filter controls for the cosine.club similar-track endpoint: release year, Discogs
 * collectors (have/want) and price, shared by playlist discovery and single-track recs. */
export function CosineSimilarFiltersControl({ filters, onChange }: CosineSimilarFiltersControlProps) {
  const ranges = filtersToRanges(filters);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <RangeControl
        title="Year"
        value={ranges.year}
        defaultRange={YEAR_RANGE}
        step={1}
        onChange={(r) =>
          onChange({
            ...filters,
            startYear: r.min === YEAR_RANGE.min ? undefined : r.min,
            endYear: r.max === YEAR_RANGE.max ? undefined : r.max,
          })
        }
      />
      <RangeControl
        title="Have"
        value={ranges.have}
        defaultRange={HAVE_RANGE}
        step={5}
        onChange={(r) =>
          onChange({
            ...filters,
            minHave: r.min === HAVE_RANGE.min ? undefined : r.min,
            maxHave: r.max === HAVE_RANGE.max ? undefined : r.max,
          })
        }
      />
      <RangeControl
        title="Want"
        value={ranges.want}
        defaultRange={WANT_RANGE}
        step={5}
        onChange={(r) =>
          onChange({
            ...filters,
            minWant: r.min === WANT_RANGE.min ? undefined : r.min,
            maxWant: r.max === WANT_RANGE.max ? undefined : r.max,
          })
        }
      />
      <RangeControl
        title="Price"
        value={ranges.price}
        defaultRange={PRICE_RANGE}
        step={5}
        format={(n) => `$${n}`}
        onChange={(r) =>
          onChange({
            ...filters,
            minPrice: r.min === PRICE_RANGE.min ? undefined : r.min,
            maxPrice: r.max === PRICE_RANGE.max ? undefined : r.max,
          })
        }
      />
    </div>
  );
}
