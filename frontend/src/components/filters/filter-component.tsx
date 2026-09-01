import {
  arousalMoodOptions,
  danceabilityFeelingOptions,
  valenceMoodOptions,
} from '@/components/track/track-feature-options';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import MultiSelect from '@/components/ui/multi-select';
import { Slider } from '@/components/ui/slider';
import { useFilters } from '@/contexts/filter-context';
import { useFilterOptionsData } from '@/hooks/useFilterOptions';
import { cn } from '@/lib/utils';
import { FunnelX } from 'lucide-react';
import { useEffect } from 'react';
import { Field, FieldGroup, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';

export const SliderComponent = ({
  handleChange,
  label,
  minValue,
  maxValue,
  rangeMinValue,
  rangeMaxValue,
  step,
  unit: _unit,
  id,
}: {
  handleChange: (value: number[]) => void;
  label: string;
  minValue: number;
  maxValue: number;
  unit: string;
  id: string;
  rangeMinValue: number;
  rangeMaxValue: number;
  step: number;
}) => (
  <div className="w-full space-y-3">
    <div className="flex items-center justify-between gap-2">
      <Label htmlFor={id + '-slider'}>{label}</Label>
      <span className="font-mono text-muted-foreground text-sm">
        {minValue} - {maxValue}
      </span>
    </div>
    <Slider
      id={id + '-slider'}
      min={rangeMinValue}
      max={rangeMaxValue}
      step={step}
      value={[minValue, maxValue]}
      onValueChange={handleChange}
      className="w-full"
    />
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">{title}</h3>
    {children}
  </div>
);

export const FilterComponent = ({
  className,
  onLoadingChange,
}: {
  className?: string;
  onLoadingChange?: (loading: boolean) => void;
}) => {
  const { filters, updateFilter, resetFilters, hasActiveFilters } = useFilters();
  const options = useFilterOptionsData();

  useEffect(() => {
    onLoadingChange?.(options.isLoading);
  }, [options.isLoading, onLoadingChange]);

  return (
    <div className={cn('flex w-full flex-col gap-6 py-6', className)}>
      <Section title="Search">
        <FieldGroup className="grid grid-cols-2">
          <Field>
            <FieldLabel htmlFor="input-artist">Artist</FieldLabel>
            <Input
              id="input-artist"
              placeholder="Search artist..."
              value={filters.artist}
              onChange={(e) => updateFilter('artist', e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="input-title">Title</FieldLabel>
            <Input
              id="input-title"
              placeholder="Search title..."
              value={filters.title}
              onChange={(e) => updateFilter('title', e.target.value)}
            />
          </Field>
        </FieldGroup>
      </Section>

      <Section title="Musical">
        <Field>
          <FieldLabel htmlFor="genres-filter">Genres</FieldLabel>
          <MultiSelect
            options={options.genres}
            value={filters.genres}
            onChange={(v) => updateFilter('genres', v)}
            placeholder="Select genres..."
            className="w-full"
            isLoading={options.isLoading}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="subgenres-filter">Subgenres</FieldLabel>
          <MultiSelect
            options={options.subgenres}
            value={filters.subgenres}
            onChange={(v) => updateFilter('subgenres', v)}
            placeholder="Select subgenres..."
            className="w-full"
            isLoading={options.isLoading}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="keys-filter">Musical keys</FieldLabel>
          <MultiSelect
            options={options.keys}
            value={filters.keyIds}
            onChange={(v) => updateFilter('keyIds', v)}
            placeholder="Select keys..."
            className="w-full"
            isLoading={options.isLoading}
          />
        </Field>
        <SliderComponent
          id="tempo"
          label="BPM"
          unit="BPM"
          minValue={filters.tempo.min}
          maxValue={filters.tempo.max}
          rangeMinValue={0}
          rangeMaxValue={200}
          step={1}
          handleChange={(v) => updateFilter('tempo', { min: v[0], max: v[1] })}
        />
      </Section>

      <Section title="Mood">
        <Field>
          <FieldLabel htmlFor="energy-filter">Energy</FieldLabel>
          <MultiSelect
            options={arousalMoodOptions}
            value={filters.arousalMood}
            onChange={(v) => updateFilter('arousalMood', v)}
            placeholder="Any energy..."
            className="w-full"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="valence-filter">Valence</FieldLabel>
          <MultiSelect
            options={valenceMoodOptions}
            value={filters.valenceMood}
            onChange={(v) => updateFilter('valenceMood', v)}
            placeholder="Any valence..."
            className="w-full"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="danceability-filter">Danceability</FieldLabel>
          <MultiSelect
            options={danceabilityFeelingOptions}
            value={filters.danceabilityFeeling}
            onChange={(v) => updateFilter('danceabilityFeeling', v)}
            placeholder="Any danceability..."
            className="w-full"
          />
        </Field>
        <SliderComponent
          id="instrumentalness"
          label="Instrumentalness"
          unit=""
          minValue={filters.instrumentalness.min}
          maxValue={filters.instrumentalness.max}
          rangeMinValue={0}
          rangeMaxValue={1}
          step={0.05}
          handleChange={(v) => updateFilter('instrumentalness', { min: v[0], max: v[1] })}
        />
      </Section>

      <Section title="Library">
        <Field>
          <FieldLabel htmlFor="library-filter">Library</FieldLabel>
          <MultiSelect
            options={options.libraries}
            value={filters.library}
            onChange={(v) => updateFilter('library', v)}
            placeholder="All libraries..."
            className="w-full"
            isLoading={options.isLoading}
          />
        </Field>
      </Section>

      <Button variant="secondary" onClick={resetFilters} disabled={!hasActiveFilters}>
        <FunnelX className="mr-2 h-4 w-4" />
        Reset filters
      </Button>
    </div>
  );
};
