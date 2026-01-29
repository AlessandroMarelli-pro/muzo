import type { CreateLibraryInput } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useCreateLibrary } from '@/services/api-hooks';
import { FolderOpen, Settings } from 'lucide-react';
import React, { useState } from 'react';
import { Field, FieldLabel } from '../ui/field';

interface CreateLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const CreateLibraryDialog: React.FC<CreateLibraryDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const createLibraryMutation = useCreateLibrary();
  const [formData, setFormData] = useState<CreateLibraryInput>({
    name: '',
    rootPath: '',
    autoScan: true,
    scanInterval: 24,
    includeSubdirectories: true,
    supportedFormats: ['MP3', 'FLAC', 'WAV', 'AAC', 'OGG', 'OPUS', 'M4A'],
    maxFileSize: 100 * 1024 * 1024, // 100MB
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof CreateLibraryInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Library name is required';
    }

    if (!formData.rootPath.trim()) {
      newErrors.rootPath = 'Root path is required';
    }

    if (formData.scanInterval && formData.scanInterval < 1) {
      newErrors.scanInterval = 'Scan interval must be at least 1 hour';
    }

    if (formData.maxFileSize && formData.maxFileSize < 1024 * 1024) {
      newErrors.maxFileSize = 'Max file size must be at least 1MB';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      try {
        // Convert form data to CreateLibraryInput format
        const createLibraryInput: CreateLibraryInput = {
          name: formData.name,
          rootPath: formData.rootPath,
          autoScan: formData.autoScan,
          scanInterval: formData.scanInterval,
          includeSubdirectories: formData.includeSubdirectories,
          supportedFormats: formData.supportedFormats,
          maxFileSize: formData.maxFileSize,
        };

        await createLibraryMutation.mutateAsync(createLibraryInput);
        onSuccess?.();
        onOpenChange(false);
      } catch (error) {
        console.error('Failed to create library:', error);
        // Error handling is managed by the mutation
      }
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!createLibraryMutation.isPending) {
      onOpenChange(newOpen);
    }
  };

  const handleBrowsePath = () => {
    // In a real implementation, this would open a file browser
    // For now, we'll just show an alert
    alert('File browser would open here. Please enter the path manually.');
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-[600px] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle>Create New Music Library</SheetTitle>
            <SheetDescription>
              Set up a new music library to organize your audio files
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 py-4 ">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center">
                <FolderOpen className="h-5 w-5 mr-2" />
                Basic Information
              </h3>

              <div className="grid gap-2">
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="name">
                    Library Name *
                  </FieldLabel>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="My Music Library"
                    disabled={createLibraryMutation.isPending}
                    className="w-xs"
                  />
                </Field>
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="rootPath">
                    Root Path *
                  </FieldLabel>
                  <Input
                    id="rootPath"
                    type="text"
                    value={formData.rootPath}
                    onChange={(e) => handleInputChange('rootPath', e.target.value)}
                    placeholder="/path/to/your/music"
                    disabled={createLibraryMutation.isPending}
                    className="w-xs"
                  />
                </Field>

                {errors.rootPath && (
                  <p className="text-sm text-red-600">{errors.rootPath}</p>
                )}
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4 pt-2 border-t">
              <h3 className="text-lg font-semibold flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Settings
              </h3>



              {formData.autoScan && (
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="scanInterval">
                    Scan Interval (hours)
                  </FieldLabel>
                  <Input
                    id="scanInterval"
                    type="number"
                    min="1"
                    value={formData.scanInterval || 0}
                    onChange={(e) =>
                      handleInputChange(
                        'scanInterval',
                        parseInt(e.target.value) || 0,
                      )
                    }
                    disabled={createLibraryMutation.isPending}
                    className="w-xs"
                  />
                  {errors.scanInterval && (
                    <p className="text-sm text-red-600">
                      {errors.scanInterval}
                    </p>
                  )}
                </Field>
              )}

              <Field orientation="horizontal">
                <FieldLabel>Supported Formats</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {formData?.supportedFormats?.map((format) => (
                    <Badge key={format} variant="secondary">
                      {format}
                    </Badge>
                  ))}
                </div>

              </Field>

              <Field orientation="horizontal">
                <FieldLabel htmlFor="maxFileSize">
                  Max File Size (MB)
                </FieldLabel>
                <Input
                  id="maxFileSize"
                  type="number"
                  min="1"
                  value={
                    formData.maxFileSize
                      ? formData.maxFileSize / (1024 * 1024)
                      : ''
                  }
                  onChange={(e) =>
                    handleInputChange(
                      'maxFileSize',
                      (parseInt(e.target.value) || 0) * 1024 * 1024,
                    )
                  }
                  disabled={createLibraryMutation.isPending}
                  className="w-xs"
                />
                {errors.maxFileSize && (
                  <p className="text-sm text-red-600">{errors.maxFileSize}</p>
                )}
              </Field>
            </div>

            {/* Error Display */}
            {createLibraryMutation.isError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">
                  Failed to create library:{' '}
                  {createLibraryMutation.error?.message || 'Unknown error'}
                </p>
              </div>
            )}
          </div>

          <SheetFooter className="flex flex-row justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createLibraryMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createLibraryMutation.isPending || !formData.name.trim() || !formData.rootPath.trim()}
            >
              {createLibraryMutation.isPending
                ? 'Creating...'
                : 'Create Library'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};
