import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MultiSelect from '@/components/ui/multi-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useFilterOptionsData } from '@/hooks/useFilterOptions';
import { useCreatePlaylist } from '@/services/playlist-hooks';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@radix-ui/react-collapsible';
import { ChevronDownIcon, Info } from 'lucide-react';
import React, { useState } from 'react';
import { SliderComponent } from '../filters/filter-component';
import { Loading } from '../loading';
import { Field, FieldLabel } from '../ui/field';
import { Item, ItemContent, ItemDescription, ItemMedia } from '../ui/item';
import { Textarea } from '../ui/textarea';

interface CreatePlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}



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

          <div className="grid gap-4 py-4 ">
            <Field orientation="horizontal">
              <FieldLabel htmlFor="name">Name *</FieldLabel>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome Playlist"
                required
                disabled={isCreating}
                className="w-xs"
              />
            </Field>

            <Field orientation="horizontal">
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A collection of my favorite songs..."
                disabled={isCreating}
                className="w-xs"
              />
            </Field>

            {/* Filters Section */}
            <Collapsible className="data-[state=open]:bg-muted rounded-md ">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="group w-full">
                  Auto-filter Tracks (Optional)
                  <ChevronDownIcon className="ml-auto group-data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col items-start gap-2 p-2.5  text-sm w-full">
                <Item size="sm" variant="outline">
                  <ItemMedia variant="icon">
                    <Info />
                  </ItemMedia>
                  <ItemContent className="w-full">
                    <ItemDescription className="w-full line-clamp-none text-wrap">
                      Tracks will be automatically selected based on the filters you select.
                    </ItemDescription>
                  </ItemContent>
                </Item>
                {/* Genres Filter */}
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="genres-filter">Genres</FieldLabel>
                  <MultiSelect
                    options={options.genres || []}
                    value={selectedGenres}
                    onChange={setSelectedGenres}
                    placeholder="Select genres..."
                    className="w-xs"
                    isLoading={options.isLoading}
                    disabled={isCreating}
                  />
                </Field>

                {/* Subgenres Filter */}
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="subgenres-filter">Subgenres</FieldLabel>
                  <MultiSelect
                    options={options.subgenres || []}
                    value={selectedSubgenres}
                    onChange={setSelectedSubgenres}
                    placeholder="Select subgenres..."
                    className="w-xs"
                    isLoading={options.isLoading}
                    disabled={isCreating}
                  />
                </Field>

                {/* Atmospheres Filter */}
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="atmospheres-filter">Atmospheres</FieldLabel>
                  <MultiSelect
                    options={options.atmospheres || []}
                    value={selectedAtmospheres}
                    onChange={setSelectedAtmospheres}
                    placeholder="Select atmospheres..."
                    className="w-xs"
                    isLoading={options.isLoading}
                    disabled={isCreating}
                  />
                </Field>

                {/* Libraries Filter */}
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="libraries-filter">Libraries</FieldLabel>
                  <MultiSelect
                    options={options.libraries || []}
                    value={selectedLibraries}
                    onChange={setSelectedLibraries}
                    placeholder="Select libraries..."
                    className="w-xs"
                    isLoading={options.isLoading}
                    disabled={isCreating}
                  />
                </Field>

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
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="maxTracks">Max Tracks</FieldLabel>
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
                    className="w-xs"
                  />
                </Field>

              </CollapsibleContent>
            </Collapsible>


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
