import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import MultiSelect from '@/components/ui/multi-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { useFilters } from '@/contexts/filter-context';
import { useFilterOptionsData } from '@/hooks/useFilterOptions';
import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { Loading } from '../loading';

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SliderComponent = ({
  handleChange,
  label,
  minValue,
  maxValue,
  rangeMinValue,
  rangeMaxValue,
  step,
  unit,
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
  <div className="space-y-3">
    <div className="flex flex-col justify-between items-left">
      <Label htmlFor="tempo-filter">{label}</Label>
      <div className="flex flex-row text-sm text-muted-foreground justify-between">
        <span className="text-sm text-muted-foreground justify-between">
          {minValue} {unit}
        </span>
        <span className="text-sm text-muted-foreground justify-between">
          {maxValue} {unit}
        </span>
      </div>
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
export function FilterSheet({ open, onOpenChange }: FilterSheetProps) {
  const {
    filters,
    updateFilter,
    resetFilters,
    hasActiveFilters,
    loadSavedFilter,
    saveCurrentFilter,
    isLoading: isFilterLoading,
  } = useFilters();
  const options = useFilterOptionsData();

  // Load saved filter when component mounts
  useEffect(() => {
    if (open) {
      loadSavedFilter();
    }
  }, [open]);
  const handleSaveFilter = async () => {
    try {
      await saveCurrentFilter();
    } catch (error) {
      console.error('Failed to save filter:', error);
    }
  };
  useEffect(() => {
    handleSaveFilter();
  }, [filters]);
  if (options.isLoading) {
    return <Loading />;
  }

  const handleGenreChange = (selected: string[]) => {
    updateFilter('genres', selected);
  };

  const handleSubgenreChange = (selected: string[]) => {
    updateFilter('subgenres', selected);
  };

  const handleKeyChange = (selected: string[]) => {
    updateFilter('keys', selected);
  };

  const handleTempoChange = (value: number[]) => {
    updateFilter('tempo', { min: value[0], max: value[1] });
  };

  const handleSpeechinessChange = (value: number[]) => {
    updateFilter('speechiness', { min: value[0], max: value[1] });
  };

  const handleInstrumentalnessChange = (value: number[]) => {
    updateFilter('instrumentalness', { min: value[0], max: value[1] });
  };

  const handleLivenessChange = (value: number[]) => {
    updateFilter('liveness', { min: value[0], max: value[1] });
  };

  const handleAcousticnessChange = (value: number[]) => {
    updateFilter('acousticness', { min: value[0], max: value[1] });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="sm:max-w-[500px] z-1000 overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Filter Tracks{' '}
            {isFilterLoading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
          </SheetTitle>
          <SheetDescription>
            Filter your music collection by various criteria.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pb-6 w-full px-4 mx-auto">
          {/* Genres Filter */}
          <div className="space-y-2">
            <Label htmlFor="genres-filter">Genres</Label>
            <MultiSelect
              options={options.genres}
              value={filters.genres}
              onChange={handleGenreChange}
              placeholder="Select genres..."
              className="w-full"
              isLoading={options.isLoading}
            />
          </div>

          {/* Subgenres Filter */}
          <div className="space-y-2">
            <Label htmlFor="subgenres-filter">Subgenres</Label>
            <MultiSelect
              options={options.subgenres}
              value={filters.subgenres}
              onChange={handleSubgenreChange}
              placeholder="Select subgenres..."
              className="w-full"
              isLoading={options.isLoading}
            />
          </div>

          {/* Key Filter */}
          <div className="space-y-2">
            <Label htmlFor="keys-filter">Musical Keys</Label>
            <MultiSelect
              options={options.keys}
              value={filters.keys}
              onChange={handleKeyChange}
              placeholder="Select keys..."
              className="w-full "
              isLoading={options.isLoading}
            />
          </div>

          {/* Tempo Filter */}
          <SliderComponent
            id="tempo"
            label="BPM"
            unit="BPM"
            minValue={filters.tempo.min}
            maxValue={filters.tempo.max}
            rangeMinValue={0}
            rangeMaxValue={200}
            step={1}
            handleChange={handleTempoChange}
          />

          {/* Energy Filter */}
          {/*   <SliderComponent
            id="energy"
            label="Energy"
            unit=""
            minValue={filters.energy.min}
            maxValue={filters.energy.max}
            rangeMinValue={0}
            rangeMaxValue={1}
            step={0.1}
            handleChange={handleEnergyChange}
          /> */}

          {/* Danceability Filter */}
          {/*  <SliderComponent
            id="danceability"
            label="Danceability"
            unit=""
            minValue={filters.danceability.min}
            maxValue={filters.danceability.max}
            rangeMinValue={0}
            rangeMaxValue={1}
            step={0.1}
            handleChange={handleDanceabilityChange}
          />
 */}
          {/* Valence Filter */}
          {/*  <SliderComponent
            id="valence"
            label="Valence (Mood)"
            unit=""
            minValue={filters.valence.min}
            maxValue={filters.valence.max}
            rangeMinValue={0}
            rangeMaxValue={1}
            step={0.1}
            handleChange={handleValenceChange}
          /> */}

          {/* Speechiness Filter */}
          <SliderComponent
            id="speechiness"
            label="Speechiness"
            unit=""
            minValue={filters.speechiness.min}
            maxValue={filters.speechiness.max}
            rangeMinValue={0}
            rangeMaxValue={1}
            step={0.1}
            handleChange={handleSpeechinessChange}
          />

          {/* Instrumentalness Filter */}
          <SliderComponent
            id="instrumentalness"
            label="Instrumentalness"
            unit=""
            minValue={filters.instrumentalness.min}
            maxValue={filters.instrumentalness.max}
            rangeMinValue={0}
            rangeMaxValue={1}
            step={0.1}
            handleChange={handleInstrumentalnessChange}
          />

          {/* Liveness Filter */}
          <SliderComponent
            id="liveness"
            label="Liveness"
            unit=""
            minValue={filters.liveness.min}
            maxValue={filters.liveness.max}
            rangeMinValue={0}
            rangeMaxValue={1}
            step={0.1}
            handleChange={handleLivenessChange}
          />

          {/* Acousticness Filter */}
          <SliderComponent
            id="acousticness"
            label="Acousticness"
            unit=""
            minValue={filters.acousticness.min}
            maxValue={filters.acousticness.max}
            rangeMinValue={0}
            rangeMaxValue={1}
            step={0.1}
            handleChange={handleAcousticnessChange}
          />

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="flex-1"
            >
              Reset Filters
            </Button>

            <Button
              variant="default"
              onClick={() => {
                handleSaveFilter();
                onOpenChange(false);
              }}
              className="flex-1"
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
