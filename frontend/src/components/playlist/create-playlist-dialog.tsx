import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MultiSelect from '@/components/ui/multi-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { useFilterOptionsData } from '@/hooks/useFilterOptions';
import { useCreatePlaylist } from '@/services/playlist-hooks';
import React, { useState } from 'react';
import { Loading } from '../loading';

interface CreatePlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
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
      <Label htmlFor={id}>{label}</Label>
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

export function CreatePlaylistDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreatePlaylistDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Filter states
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedSubgenres, setSelectedSubgenres] = useState<string[]>([]);
  const [selectedAtmospheres, setSelectedAtmospheres] = useState<string[]>([]);
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>([]);
  const [bpmRange, setBpmRange] = useState<[number, number]>([0, 200]);
  const [maxTracks, setMaxTracks] = useState<number>(100);

  const { createPlaylist } = useCreatePlaylist();
  const options = useFilterOptionsData();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      return;
    }

    setIsCreating(true);
    try {
      // Build filter input if any filters are selected
      const filters =
        selectedGenres.length > 0 ||
        selectedSubgenres.length > 0 ||
        selectedAtmospheres.length > 0 ||
        selectedLibraries.length > 0 ||
        bpmRange[0] !== 0 ||
        bpmRange[1] !== 200
          ? {
              genres: selectedGenres.length > 0 ? selectedGenres : undefined,
              subgenres:
                selectedSubgenres.length > 0 ? selectedSubgenres : undefined,
              atmospheres:
                selectedAtmospheres.length > 0
                  ? selectedAtmospheres
                  : undefined,
              libraryId:
                selectedLibraries.length > 0
                  ? selectedLibraries
                  : undefined,
              tempo:
                bpmRange[0] !== 0 || bpmRange[1] !== 200
                  ? {
                      min: bpmRange[0] !== 0 ? bpmRange[0] : undefined,
                      max: bpmRange[1] !== 200 ? bpmRange[1] : undefined,
                    }
                  : undefined,
            }
          : undefined;

      await createPlaylist({
        name: name.trim(),
        description: description.trim() || undefined,
        isPublic,
        filters,
        maxTracks: maxTracks > 0 ? maxTracks : undefined,
      } as any);

      // Reset form
      setName('');
      setDescription('');
      setIsPublic(false);
      setSelectedGenres([]);
      setSelectedSubgenres([]);
      setSelectedAtmospheres([]);
      setSelectedLibraries([]);
      setBpmRange([0, 200]);
      setMaxTracks(100);

      onSuccess();
    } catch (error) {
      console.error('Failed to create playlist:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isCreating) {
      onOpenChange(newOpen);
    }
  };

  const handleBpmChange = (value: number[]) => {
    setBpmRange([value[0], value[1]]);
  };

  if (options.isLoading) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="sm:max-w-[425px]">
          <Loading />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-[500px] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle>Create New Playlist</SheetTitle>
            <SheetDescription>
              Create a new playlist to organize your music collection.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 py-4 px-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome Playlist"
                required
                disabled={isCreating}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A collection of my favorite songs..."
                disabled={isCreating}
              />
            </div>

            {/* Filters Section */}
            <div className="space-y-4 pt-2 border-t">
              <h3 className="text-sm font-semibold">
                Filter Tracks (Optional)
              </h3>

              {/* Genres Filter */}
              <div className="space-y-2">
                <Label htmlFor="genres-filter">Genres</Label>
                <MultiSelect
                  options={options.genres || []}
                  value={selectedGenres}
                  onChange={setSelectedGenres}
                  placeholder="Select genres..."
                  className="w-full"
                  isLoading={options.isLoading}
                  disabled={isCreating}
                />
              </div>

              {/* Subgenres Filter */}
              <div className="space-y-2">
                <Label htmlFor="subgenres-filter">Subgenres</Label>
                <MultiSelect
                  options={options.subgenres || []}
                  value={selectedSubgenres}
                  onChange={setSelectedSubgenres}
                  placeholder="Select subgenres..."
                  className="w-full"
                  isLoading={options.isLoading}
                  disabled={isCreating}
                />
              </div>

              {/* Atmospheres Filter */}
              <div className="space-y-2">
                <Label htmlFor="atmospheres-filter">Atmospheres</Label>
                <MultiSelect
                  options={options.atmospheres || []}
                  value={selectedAtmospheres}
                  onChange={setSelectedAtmospheres}
                  placeholder="Select atmospheres..."
                  className="w-full"
                  isLoading={options.isLoading}
                  disabled={isCreating}
                />
              </div>

              {/* Libraries Filter */}
              <div className="space-y-2">
                <Label htmlFor="libraries-filter">Libraries</Label>
                <MultiSelect
                  options={options.libraries || []}
                  value={selectedLibraries}
                  onChange={setSelectedLibraries}
                  placeholder="Select libraries..."
                  className="w-full"
                  isLoading={options.isLoading}
                  disabled={isCreating}
                />
              </div>

              {/* BPM Filter */}
              <SliderComponent
                id="bpm"
                label="BPM"
                unit="BPM"
                minValue={bpmRange[0]}
                maxValue={bpmRange[1]}
                rangeMinValue={0}
                rangeMaxValue={200}
                step={1}
                handleChange={handleBpmChange}
              />

              {/* Max Tracks */}
              <div className="grid gap-2">
                <Label htmlFor="maxTracks">Max Tracks</Label>
                <Input
                  id="maxTracks"
                  type="number"
                  min="1"
                  value={maxTracks}
                  onChange={(e) =>
                    setMaxTracks(parseInt(e.target.value) || 100)
                  }
                  placeholder="100"
                  disabled={isCreating}
                />
              </div>
            </div>
          </div>

          <SheetFooter className="flex flex-row justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !name.trim()}>
              {isCreating ? 'Creating...' : 'Create Playlist'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
