import { Test, TestingModule } from '@nestjs/testing';
import { UserPreferencesResolver } from './user-preferences.resolver';

describe('UserPreferencesResolver', () => {
  let resolver: UserPreferencesResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserPreferencesResolver],
    }).compile();

    resolver = module.get<UserPreferencesResolver>(UserPreferencesResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('preferences', () => {
    it('should return default preferences', async () => {
      const result = await resolver.preferences();

      expect(result).toBeDefined();
      expect(result.id).toBe('default');
      expect(result.analysisPreferences).toEqual({
        autoAnalyze: true,
        confidenceThreshold: 0.8,
        preferredGenres: [],
        skipLowConfidence: false,
      });
      expect(result.organizationPreferences).toEqual({
        autoOrganize: false,
        organizationMethod: 'GENRE',
        createPlaylists: false,
        exportToDJSoftware: false,
      });
      expect(result.editorPreferences).toEqual({
        showConfidenceScores: true,
        batchMode: false,
        autoSave: true,
        undoLevels: 10,
      });
      expect(result.uiPreferences).toEqual({
        theme: 'system',
        language: 'en',
        defaultView: 'GRID',
      });
    });
  });

  describe('updatePreferences', () => {
    it('should update analysis preferences', async () => {
      const input = {
        analysisPreferences: {
          autoAnalyze: false,
          confidenceThreshold: 0.9,
          preferredGenres: ['Rock', 'Pop'],
          skipLowConfidence: true,
        },
      };

      const result = await resolver.updatePreferences(input);

      expect(result.analysisPreferences).toEqual({
        autoAnalyze: false,
        confidenceThreshold: 0.9,
        preferredGenres: ['Rock', 'Pop'],
        skipLowConfidence: true,
      });
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should update organization preferences', async () => {
      const input = {
        organizationPreferences: {
          autoOrganize: true,
          organizationMethod: 'ARTIST',
          createPlaylists: true,
          exportToDJSoftware: true,
        },
      };

      const result = await resolver.updatePreferences(input);

      expect(result.organizationPreferences).toEqual({
        autoOrganize: true,
        organizationMethod: 'ARTIST',
        createPlaylists: true,
        exportToDJSoftware: true,
      });
    });

    it('should update editor preferences', async () => {
      const input = {
        editorPreferences: {
          showConfidenceScores: false,
          batchMode: true,
          autoSave: false,
          undoLevels: 5,
        },
      };

      const result = await resolver.updatePreferences(input);

      expect(result.editorPreferences).toEqual({
        showConfidenceScores: false,
        batchMode: true,
        autoSave: false,
        undoLevels: 5,
      });
    });

    it('should update UI preferences', async () => {
      const input = {
        uiPreferences: {
          theme: 'dark',
          language: 'es',
          defaultView: 'LIST',
        },
      };

      const result = await resolver.updatePreferences(input);

      expect(result.uiPreferences).toEqual({
        theme: 'dark',
        language: 'es',
        defaultView: 'LIST',
      });
    });

    it('should update multiple preference categories', async () => {
      const input = {
        analysisPreferences: {
          autoAnalyze: false,
        },
        uiPreferences: {
          theme: 'light',
        },
      };

      const result = await resolver.updatePreferences(input);

      expect(result.analysisPreferences.autoAnalyze).toBe(false);
      expect(result.uiPreferences.theme).toBe('light');
      // Other preferences should remain unchanged
      expect(result.analysisPreferences.confidenceThreshold).toBe(0.8);
      expect(result.uiPreferences.language).toBe('en');
    });

    it('should preserve existing preferences when updating partial data', async () => {
      const input = {
        analysisPreferences: {
          autoAnalyze: false,
        },
      };

      const result = await resolver.updatePreferences(input);

      expect(result.analysisPreferences.autoAnalyze).toBe(false);
      expect(result.analysisPreferences.confidenceThreshold).toBe(0.8); // Should remain unchanged
      expect(result.organizationPreferences.autoOrganize).toBe(false); // Should remain unchanged
    });
  });
});
