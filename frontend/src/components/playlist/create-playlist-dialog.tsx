import { Badge } from '@/components/ui/badge';
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
import { Switch } from '@/components/ui/switch';
import { useFilterOptionsData } from '@/hooks/useFilterOptions';
import { useCreatePlaylist } from '@/services/playlist-hooks';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@radix-ui/react-collapsible';
import { useRouter } from '@tanstack/react-router';
import { ChevronDownIcon, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SliderComponent } from '../filters/filter-component';
import { Loading } from '../loading';
import { Textarea } from '../ui/textarea';

interface CreatePlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const BPM_MIN = 0;
const BPM_MAX = 200;
const DEFAULT_MAX_TRACKS = 100;

export function CreatePlaylistDialog({ open, onOpenChange, onSuccess }: CreatePlaylistDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const router = useRouter();

  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedSubgenres, setSelectedSubgenres] = useState<string[]>([]);
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>([]);
  const [bpmRange, setBpmRange] = useState<[number, number]>([BPM_MIN, BPM_MAX]);
  const [maxTracks, setMaxTracks] = useState<number | ''>(DEFAULT_MAX_TRACKS);
  const [subgenreSelectionMode, setSubgenreSelectionMode] = useState<'exact' | 'contain'>('exact');

  const { createPlaylist } = useCreatePlaylist();
  const options = useFilterOptionsData();

  const bpmNarrowed = bpmRange[0] !== BPM_MIN || bpmRange[1] !== BPM_MAX;

  const labelFor = (list: { label: string; value: string }[], value: string) =>
    list.find((o) => o.value === value)?.label ?? value;

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    selectedGenres.forEach((id) =>
      chips.push({
        key: `g-${id}`,
        label: labelFor(options.genres || [], id),
        clear: () => setSelectedGenres((prev) => prev.filter((v) => v !== id)),
      }),
    );
    selectedSubgenres.forEach((id) =>
      chips.push({
        key: `s-${id}`,
        label: labelFor(options.subgenres || [], id),
        clear: () => setSelectedSubgenres((prev) => prev.filter((v) => v !== id)),
      }),
    );
    selectedLibraries.forEach((id) =>
      chips.push({
        key: `l-${id}`,
        label: labelFor(options.libraries || [], id),
        clear: () => setSelectedLibraries((prev) => prev.filter((v) => v !== id)),
      }),
    );
    if (bpmNarrowed) {
      chips.push({
        key: 'bpm',
        label: `${bpmRange[0]}–${bpmRange[1]} BPM`,
        clear: () => setBpmRange([BPM_MIN, BPM_MAX]),
      });
    }
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGenres, selectedSubgenres, selectedLibraries, bpmRange, options]);

  const hasFilters = activeFilters.length > 0;

  const resetForm = () => {
    setName('');
    setDescription('');
    setNameError('');
    setSubmitError('');
    setFiltersOpen(false);
    setSelectedGenres([]);
    setSelectedSubgenres([]);
    setSelectedLibraries([]);
    setBpmRange([BPM_MIN, BPM_MAX]);
    setMaxTracks(DEFAULT_MAX_TRACKS);
    setSubgenreSelectionMode('exact');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Give the playlist a name.');
      setTimeout(() => document.getElementById('playlist-name')?.focus(), 0);
      return;
    }
    setNameError('');
    setSubmitError('');
    setIsCreating(true);
    try {
      const filters = hasFilters
        ? {
            genreIds: selectedGenres.length ? selectedGenres : undefined,
            subgenreIds: selectedSubgenres.length ? selectedSubgenres : undefined,
            libraryIds: selectedLibraries.length ? selectedLibraries : undefined,
            tempo: bpmNarrowed
              ? {
                  min: bpmRange[0] !== BPM_MIN ? bpmRange[0] : undefined,
                  max: bpmRange[1] !== BPM_MAX ? bpmRange[1] : undefined,
                }
              : undefined,
          }
        : undefined;

      const limit = typeof maxTracks === 'number' && maxTracks > 0 ? maxTracks : undefined;

      const playlist = await createPlaylist({
        name: name.trim(),
        description: description.trim() || undefined,
        isPublic: false,
        filters,
        maxTracks: limit,
        subgenreSelectionMode: selectedSubgenres.length ? subgenreSelectionMode : undefined,
      } as Parameters<typeof createPlaylist>[0]);
      await router.invalidate();

      toast.success(`“${playlist.name}” created`, {
        description: hasFilters
          ? 'Muzo is filling it with matching tracks.'
          : undefined,
      });
      resetForm();
      onSuccess();
    } catch (error) {
      setSubmitError(
        (error as Error)?.message || 'Something went wrong. Please try again.',
      );
      setTimeout(() => document.getElementById('playlist-submit-error')?.focus(), 0);
      console.error('Failed to create playlist:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isCreating) return;
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[500px]">
        <SheetHeader className="space-y-1.5 px-6 pb-4 pt-6 text-left">
          <SheetTitle className="text-xl">New playlist</SheetTitle>
          <SheetDescription>
            Name it now, or let Muzo fill it from your library with a set of filters.
          </SheetDescription>
        </SheetHeader>

        {options.isLoading ? (
          <div className="flex flex-1 items-center justify-center px-6 pb-10">
            <Loading />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6">
              <div className="space-y-2">
                <label
                  htmlFor="playlist-name"
                  className="text-sm font-medium text-foreground"
                >
                  Name
                </label>
                <Input
                  id="playlist-name"
                  name="playlist-name"
                  type="text"
                  autoComplete="off"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError('');
                  }}
                  placeholder="Peak-time techno"
                  disabled={isCreating}
                  aria-invalid={!!nameError}
                  aria-describedby={nameError ? 'playlist-name-error' : undefined}
                />
                {nameError && (
                  <p
                    id="playlist-name-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {nameError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="playlist-description"
                  className="text-sm font-medium text-foreground"
                >
                  Description <span className="text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  id="playlist-description"
                  name="playlist-description"
                  autoComplete="off"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this set is for…"
                  disabled={isCreating}
                />
              </div>

              {/* Filter builder ------------------------------------------------- */}
              <Collapsible
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
                className="rounded-md border border-sidebar-border"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent"
                  >
                    <span>
                      Build from filters
                      {hasFilters && (
                        <span className="ml-2 text-muted-foreground">
                          {activeFilters.length} active
                        </span>
                      )}
                    </span>
                    <ChevronDownIcon
                      className={`size-4 text-muted-foreground transition-transform ${
                        filtersOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </CollapsibleTrigger>

                {hasFilters && !filtersOpen && (
                  <div className="flex flex-wrap gap-1.5 border-t border-sidebar-border px-3 py-2.5">
                    {activeFilters.map((chip) => (
                      <Badge key={chip.key} variant="secondary" className="gap-1 pr-1">
                        {chip.label}
                        <button
                          type="button"
                          onClick={chip.clear}
                          aria-label={`Remove ${chip.label} filter`}
                          className="rounded-full p-0.5 hover:bg-foreground/10"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <CollapsibleContent className="space-y-4 border-t border-sidebar-border px-3 py-4 text-sm">
                  <p className="text-xs text-muted-foreground">
                    When you create the playlist, Muzo adds every track in your library that
                    matches all of these.
                  </p>

                  <div className="space-y-2">
                    <span id="playlist-genres-label" className="text-sm font-medium">
                      Genres
                    </span>
                    <MultiSelect
                      aria-labelledby="playlist-genres-label"
                      options={options.genres || []}
                      value={selectedGenres}
                      onChange={setSelectedGenres}
                      placeholder="Any genre"
                      searchPlaceholder="Search genres…"
                      emptyMessage="No genres match."
                      isLoading={options.isLoading}
                      disabled={isCreating}
                    />
                  </div>

                  <div className="space-y-2">
                    <span id="playlist-subgenres-label" className="text-sm font-medium">
                      Subgenres
                    </span>
                    <MultiSelect
                      aria-labelledby="playlist-subgenres-label"
                      options={options.subgenres || []}
                      value={selectedSubgenres}
                      onChange={setSelectedSubgenres}
                      placeholder="Any subgenre"
                      searchPlaceholder="Search subgenres…"
                      emptyMessage="No subgenres match."
                      isLoading={options.isLoading}
                      disabled={isCreating}
                    />
                  </div>

                  {selectedSubgenres.length > 0 && (
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <label
                          htmlFor="playlist-subgenre-mode"
                          className="text-sm font-medium"
                        >
                          Match any subgenre
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {subgenreSelectionMode === 'contain'
                            ? 'A track needs just one of the selected subgenres.'
                            : 'A track must carry every selected subgenre.'}
                        </p>
                      </div>
                      <Switch
                        id="playlist-subgenre-mode"
                        checked={subgenreSelectionMode === 'contain'}
                        onCheckedChange={(checked) =>
                          setSubgenreSelectionMode(checked ? 'contain' : 'exact')
                        }
                        disabled={isCreating}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <span id="playlist-libraries-label" className="text-sm font-medium">
                      Libraries
                    </span>
                    <MultiSelect
                      aria-labelledby="playlist-libraries-label"
                      options={options.libraries || []}
                      value={selectedLibraries}
                      onChange={setSelectedLibraries}
                      placeholder="All libraries"
                      searchPlaceholder="Search libraries…"
                      emptyMessage="No libraries match."
                      isLoading={options.isLoading}
                      disabled={isCreating}
                    />
                  </div>

                  <SliderComponent
                    id="bpm"
                    label="BPM"
                    unit="BPM"
                    minValue={bpmRange[0]}
                    maxValue={bpmRange[1]}
                    rangeMinValue={BPM_MIN}
                    rangeMaxValue={BPM_MAX}
                    step={1}
                    handleChange={(value) => setBpmRange([value[0], value[1]])}
                  />

                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="playlist-max-tracks" className="text-sm font-medium">
                      Track limit
                    </label>
                    <Input
                      id="playlist-max-tracks"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={5000}
                      value={maxTracks}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setMaxTracks(raw === '' ? '' : Math.max(0, parseInt(raw, 10) || 0));
                      }}
                      placeholder="No limit"
                      disabled={isCreating}
                      className="w-24 text-right font-mono"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {submitError && (
                <div
                  id="playlist-submit-error"
                  role="alert"
                  tabIndex={-1}
                  className="rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive outline-none"
                >
                  Couldn’t create the playlist: {submitError}
                </div>
              )}
            </div>

            <SheetFooter className="flex flex-row justify-end gap-2 border-t border-sidebar-border px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating
                  ? 'Creating…'
                  : hasFilters
                    ? 'Create & fill playlist'
                    : 'Create playlist'}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
