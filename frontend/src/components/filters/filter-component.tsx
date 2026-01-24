
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

        <div className="flex items-center justify-between gap-2">
            <Label htmlFor="tempo-filter">{label}</Label>
            <span className="text-muted-foreground text-sm">
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

export const FilterComponent = ({ className, onLoadingChange }: { className?: string, onLoadingChange?: (loading: boolean) => void }) => {
    const {
        filters,
        updateFilter,
        resetFilters,
        hasActiveFilters,
        loadSavedFilter,
        saveCurrentFilter,
    } = useFilters();
    const options = useFilterOptionsData();

    // Load saved filter when component mounts
    useEffect(() => {
        loadSavedFilter
    }, []);
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

    useEffect(() => {
        onLoadingChange?.(options.isLoading);
    }, [options.isLoading]);

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

    const handleAtmosphereChange = (selected: string[]) => {
        updateFilter('atmospheres', selected);
    };

    const handleArtistChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        updateFilter('artist', value);
    };
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        updateFilter('title', value);
    };

    return (
        <div className={cn("flex flex-col gap-2 py-6 w-full  ", className)}>

            <FieldGroup className="grid  grid-cols-2">

                <Field>
                    <FieldLabel htmlFor="input-artist">Artist</FieldLabel>
                    <Input id="input-artist" placeholder="Search artist..."
                        value={filters.artist}
                        onChange={handleArtistChange}
                    />
                </Field>
                <Field>
                    <FieldLabel htmlFor="input-title">Title</FieldLabel>
                    <Input id="input-title" placeholder="Search title..."

                        value={filters.title}
                        onChange={handleTitleChange}
                    />
                </Field>
            </FieldGroup>

            {/* Genres Filter */}
            <Field>
                <FieldLabel htmlFor="genres-filter">Genres</FieldLabel>
                <MultiSelect
                    options={options.genres}
                    value={filters.genres}
                    onChange={handleGenreChange}
                    placeholder="Select genres..."
                    className="w-full "
                    isLoading={options.isLoading}
                />
            </Field>

            {/* Subgenres Filter */}
            <Field>
                <FieldLabel htmlFor="subgenres-filter">Subgenres</FieldLabel>
                <MultiSelect
                    options={options.subgenres}
                    value={filters.subgenres}
                    onChange={handleSubgenreChange}
                    placeholder="Select subgenres..."
                    className="w-full"
                    isLoading={options.isLoading}
                />
            </Field>

            {/* Key Filter */}
            <Field>
                <FieldLabel htmlFor="keys-filter">Musical Keys</FieldLabel>
                <MultiSelect
                    options={options.keys}
                    value={filters.keys}
                    onChange={handleKeyChange}
                    placeholder="Select keys..."
                    className="w-full "
                    isLoading={options.isLoading}
                />
            </Field>
            {/* Atmospheres Filter */}
            <Field>
                <FieldLabel htmlFor="atmospheres-filter">Atmospheres</FieldLabel>
                <MultiSelect
                    options={options.atmospheres}
                    value={filters.atmospheres}
                    onChange={handleAtmosphereChange}
                    placeholder="Select atmospheres..."
                    className="w-full"
                    isLoading={options.isLoading}
                />
            </Field>

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




            <Button
                variant="secondary"
                onClick={resetFilters}
                disabled={!hasActiveFilters}
            >
                <FunnelX className="h-4 w-4 mr-2" />
                Reset Filters
            </Button>

        </div>
    )
}