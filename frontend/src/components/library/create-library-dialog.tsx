import type { CreateLibraryInput, Library } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useCreateLibrary } from '@/services/api-hooks';
import { useRouter } from '@tanstack/react-router';
import React, { useState } from 'react';
import { toast } from 'sonner';

interface CreateLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (library: Library) => void;
}

const ALL_FORMATS = ['MP3', 'FLAC', 'WAV', 'AAC', 'OGG', 'OPUS', 'M4A'] as const;
const DEFAULT_MAX_FILE_SIZE_MB = 100;

const initialState: CreateLibraryInput = {
  name: '',
  rootPath: '',
  autoScan: true,
  scanInterval: 24,
  includeSubdirectories: true,
  supportedFormats: [...ALL_FORMATS],
  maxFileSize: DEFAULT_MAX_FILE_SIZE_MB * 1024 * 1024,
};

/** Best-effort last path segment, for suggesting a library name from a folder. */
const folderName = (path: string) =>
  path
    .replace(/[\\/]+$/, '')
    .split(/[\\/]/)
    .filter(Boolean)
    .pop() ?? '';

export const CreateLibraryDialog: React.FC<CreateLibraryDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const createLibraryMutation = useCreateLibrary();
  const router = useRouter();
  const [formData, setFormData] = useState<CreateLibraryInput>(initialState);
  // Whether the user has typed the name themselves; until then it tracks the folder.
  const [nameTouched, setNameTouched] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; rootPath?: string; scanInterval?: string }>(
    {},
  );

  const isPending = createLibraryMutation.isPending;
  const submitError = createLibraryMutation.isError
    ? createLibraryMutation.error?.message || 'Something went wrong. Please try again.'
    : null;

  const reset = () => {
    setFormData(initialState);
    setNameTouched(false);
    setErrors({});
    createLibraryMutation.reset();
  };

  const patch = (next: Partial<CreateLibraryInput>) => setFormData((prev) => ({ ...prev, ...next }));

  const setRootPath = (rootPath: string) => {
    setErrors((e) => ({ ...e, rootPath: undefined }));
    const suggested = folderName(rootPath);
    patch({
      rootPath,
      // Keep the name in sync with the folder until the user edits it directly.
      ...(nameTouched ? {} : { name: suggested }),
    });
  };

  const toggleFormat = (format: string, checked: boolean) => {
    const current = formData.supportedFormats ?? [];
    patch({
      supportedFormats: checked
        ? [...current, format]
        : current.filter((f) => f !== format),
    });
  };

  const validate = (): keyof typeof errors | null => {
    const next: typeof errors = {};
    if (!formData.name.trim()) {
      next.name = 'Give the library a name.';
    }
    const path = formData.rootPath.trim();
    if (!path) {
      next.rootPath = 'Enter the folder where this music lives.';
    } else if (!/^(\/|[A-Za-z]:[\\/]|\\\\)/.test(path)) {
      next.rootPath = 'Use a full path, e.g. /Users/you/Music or D:\\Music.';
    }
    if (formData.autoScan && (formData.scanInterval ?? 0) < 1) {
      next.scanInterval = 'Rescan at least once an hour.';
    }
    setErrors(next);
    return (Object.keys(next)[0] as keyof typeof errors) ?? null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const firstError = validate();
    if (firstError) {
      const id = firstError === 'scanInterval' ? 'library-scan-interval' : `library-${firstError}`;
      setTimeout(() => document.getElementById(id)?.focus(), 0);
      return;
    }
    try {
      const library = await createLibraryMutation.mutateAsync({
        name: formData.name.trim(),
        rootPath: formData.rootPath.trim(),
        autoScan: formData.autoScan,
        scanInterval: formData.autoScan ? formData.scanInterval : undefined,
        includeSubdirectories: formData.includeSubdirectories,
        supportedFormats: formData.supportedFormats,
        maxFileSize: formData.maxFileSize,
      });
      toast.success(`“${library.name}” created`, { description: 'Scanning the folder now.' });
      onSuccess?.(library);
      onOpenChange(false);
      reset();
      await router.invalidate();
    } catch (error) {
      // Surfaced inline via submitError; keep the sheet open with values intact.
      setTimeout(
        () => document.getElementById('library-submit-error')?.focus(),
        0,
      );
      console.error('Failed to create library:', error);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending) return;
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const resolvedFormats = formData.supportedFormats ?? [];
  const maxFileSizeMb = formData.maxFileSize
    ? Math.round(formData.maxFileSize / (1024 * 1024))
    : DEFAULT_MAX_FILE_SIZE_MB;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[520px]">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <SheetHeader className="space-y-1.5 px-6 pb-4 pt-6 text-left">
            <SheetTitle className="text-xl">Add a library</SheetTitle>
            <SheetDescription>
              Choose a folder of audio files. Muzo scans it, tags every track, and keeps it
              organized.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6">
            {/* Where the music lives -------------------------------------------------- */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="library-rootPath"
                  className="text-sm font-medium text-foreground"
                >
                  Music folder
                </label>
                <p className="text-xs text-muted-foreground">
                  The full path on the machine running Muzo. Sub-folders are scanned too.
                </p>
              </div>

              <Input
                id="library-rootPath"
                name="library-root-path"
                type="text"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={formData.rootPath}
                onChange={(e) => setRootPath(e.target.value)}
                placeholder="/Users/you/Music/DJ"
                disabled={isPending}
                className="w-full font-mono text-sm"
                aria-invalid={!!errors.rootPath}
                aria-describedby={
                  errors.rootPath ? 'library-rootPath-error' : 'library-rootPath-hint'
                }
              />

              {errors.rootPath ? (
                <p
                  id="library-rootPath-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.rootPath}
                </p>
              ) : (
                <p id="library-rootPath-hint" className="text-xs text-muted-foreground">
                  e.g. <span className="font-mono">/Users/you/Music</span> or{' '}
                  <span className="font-mono">D:\Music</span>. Paste it from Finder or your
                  file manager.
                </p>
              )}
            </div>

            {/* Name ---------------------------------------------------------------- */}
            <div className="space-y-2">
              <label htmlFor="library-name" className="text-sm font-medium text-foreground">
                Name
              </label>
              <Input
                id="library-name"
                name="library-name"
                type="text"
                autoComplete="off"
                value={formData.name}
                onChange={(e) => {
                  setNameTouched(true);
                  setErrors((err) => ({ ...err, name: undefined }));
                  patch({ name: e.target.value });
                }}
                placeholder="My DJ crates"
                disabled={isPending}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'library-name-error' : undefined}
              />
              {errors.name && (
                <p id="library-name-error" role="alert" className="text-sm text-destructive">
                  {errors.name}
                </p>
              )}
            </div>

            {/* How it scans ------------------------------------------------------- */}
            <div className="space-y-5 border-t border-sidebar-border pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <label
                    htmlFor="library-auto-scan"
                    className="text-sm font-medium text-foreground"
                  >
                    Keep it up to date
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Rescan on a schedule so new files show up on their own.
                  </p>
                </div>
                <Switch
                  id="library-auto-scan"
                  checked={!!formData.autoScan}
                  onCheckedChange={(checked) => patch({ autoScan: checked })}
                  disabled={isPending}
                />
              </div>

              {formData.autoScan && (
                <div className="flex items-center justify-between gap-4 pl-0">
                  <label
                    htmlFor="library-scan-interval"
                    className="text-sm text-foreground"
                  >
                    Rescan every
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="library-scan-interval"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={168}
                      value={formData.scanInterval ?? 0}
                      onChange={(e) => {
                        setErrors((err) => ({ ...err, scanInterval: undefined }));
                        patch({ scanInterval: parseInt(e.target.value, 10) || 0 });
                      }}
                      disabled={isPending}
                      className="w-20 text-right font-mono"
                      aria-invalid={!!errors.scanInterval}
                      aria-describedby={
                        errors.scanInterval ? 'library-scan-interval-error' : undefined
                      }
                    />
                    <span className="text-sm text-muted-foreground">hours</span>
                  </div>
                </div>
              )}
              {errors.scanInterval && (
                <p
                  id="library-scan-interval-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.scanInterval}
                </p>
              )}

              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <label
                    htmlFor="library-subdirs"
                    className="text-sm font-medium text-foreground"
                  >
                    Include sub-folders
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Scan every folder nested inside, not just the top level.
                  </p>
                </div>
                <Switch
                  id="library-subdirs"
                  checked={!!formData.includeSubdirectories}
                  onCheckedChange={(checked) => patch({ includeSubdirectories: checked })}
                  disabled={isPending}
                />
              </div>

              <fieldset className="space-y-2.5" disabled={isPending}>
                <legend className="text-sm font-medium text-foreground">File types</legend>
                <p className="text-xs text-muted-foreground">
                  Anything unchecked is skipped during the scan.
                </p>
                <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 pt-1 sm:grid-cols-4">
                  {ALL_FORMATS.map((format) => {
                    const id = `library-format-${format}`;
                    return (
                      <label
                        key={format}
                        htmlFor={id}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          id={id}
                          checked={resolvedFormats.includes(format)}
                          onCheckedChange={(checked) => toggleFormat(format, checked === true)}
                        />
                        {format}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="flex items-center justify-between gap-4">
                <label
                  htmlFor="library-max-size"
                  className="text-sm font-medium text-foreground"
                >
                  Skip files larger than
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="library-max-size"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10000}
                    value={maxFileSizeMb}
                    onChange={(e) =>
                      patch({
                        maxFileSize:
                          (parseInt(e.target.value, 10) || DEFAULT_MAX_FILE_SIZE_MB) *
                          1024 *
                          1024,
                      })
                    }
                    disabled={isPending}
                    className="w-24 text-right font-mono"
                  />
                  <span className="text-sm text-muted-foreground">MB</span>
                </div>
              </div>
            </div>

            {submitError && (
              <div
                id="library-submit-error"
                role="alert"
                tabIndex={-1}
                className="rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive outline-none"
              >
                Couldn’t create the library: {submitError}
              </div>
            )}
          </div>

          <SheetFooter className="flex flex-row justify-end gap-2 border-t border-sidebar-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Add library'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};
