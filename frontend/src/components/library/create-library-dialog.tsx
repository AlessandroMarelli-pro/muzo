import type { CreateLibraryInput } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCreateLibrary } from '@/services/api-hooks';
import { FolderOpen, Settings, X } from 'lucide-react';
import React, { useState } from 'react';

interface CreateLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateLibraryDialog: React.FC<CreateLibraryDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const createLibraryMutation = useCreateLibrary();
  const [formData, setFormData] = useState<CreateLibraryInput>({
    name: '',
    rootPath: '',
    autoScan: true,
    scanInterval: 24,
    includeSubdirectories: true,
    supportedFormats: ['MP3', 'FLAC', 'WAV', 'AAC', 'OGG', 'OPUS'],
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
        onClose();
      } catch (error) {
        console.error('Failed to create library:', error);
        // Error handling is managed by the mutation
      }
    }
  };

  const handleBrowsePath = () => {
    // In a real implementation, this would open a file browser
    // For now, we'll just show an alert
    alert('File browser would open here. Please enter the path manually.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Create New Music Library</CardTitle>
              <CardDescription>
                Set up a new music library to organize your audio files
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center">
                <FolderOpen className="h-5 w-5 mr-2" />
                Basic Information
              </h3>

              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Library Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My Music Library"
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="rootPath" className="text-sm font-medium">
                  Root Path *
                </label>
                <div className="flex space-x-2">
                  <input
                    id="rootPath"
                    type="text"
                    value={formData.rootPath}
                    onChange={(e) =>
                      handleInputChange('rootPath', e.target.value)
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="/path/to/your/music"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBrowsePath}
                  >
                    Browse
                  </Button>
                </div>
                {errors.rootPath && (
                  <p className="text-sm text-red-600">{errors.rootPath}</p>
                )}
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Settings
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Auto-scan</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.autoScan || false}
                      onChange={(e) =>
                        handleInputChange('autoScan', e.target.checked)
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-muted-foreground">
                      Automatically scan for new files
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Include Subdirectories
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.includeSubdirectories || false}
                      onChange={(e) =>
                        handleInputChange(
                          'includeSubdirectories',
                          e.target.checked,
                        )
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-muted-foreground">
                      Scan subdirectories
                    </span>
                  </div>
                </div>
              </div>

              {formData.autoScan && (
                <div className="space-y-2">
                  <label htmlFor="scanInterval" className="text-sm font-medium">
                    Scan Interval (hours)
                  </label>
                  <input
                    id="scanInterval"
                    type="number"
                    min="1"
                    value={formData.scanInterval || 0}
                    onChange={(e) =>
                      handleInputChange(
                        'scanInterval',
                        parseInt(e.target.value),
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.scanInterval && (
                    <p className="text-sm text-red-600">
                      {errors.scanInterval}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Supported Formats</label>
                <div className="flex flex-wrap gap-2">
                  {formData?.supportedFormats?.map((format) => (
                    <Badge key={format} variant="secondary">
                      {format}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  MP3, FLAC, WAV, AAC, OGG formats are supported
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="maxFileSize" className="text-sm font-medium">
                  Max File Size (MB)
                </label>
                <input
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
                      parseInt(e.target.value) * 1024 * 1024,
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.maxFileSize && (
                  <p className="text-sm text-red-600">{errors.maxFileSize}</p>
                )}
              </div>
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

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createLibraryMutation.isPending}>
                {createLibraryMutation.isPending
                  ? 'Creating...'
                  : 'Create Library'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
