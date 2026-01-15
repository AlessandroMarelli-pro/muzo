import { useFilters } from '@/contexts/filter-context';
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  useQueryState,
} from 'nuqs';
import { useEffect, useRef } from 'react';

export const useFilterQueryParams = () => {
  // Filter state management
  const { filters, updateFilter, saveCurrentFilter, isLoading } = useFilters();

  // URL query parameter management for filters (read-only)
  const [artistParam] = useQueryState('artist', parseAsString);
  const [titleParam] = useQueryState('title', parseAsString);
  const [genreParam] = useQueryState(
    'genres',
    parseAsArrayOf(parseAsString, ',').withDefault([]),
  );

  const [subgenreParam] = useQueryState(
    'subgenres',
    parseAsArrayOf(parseAsString, ',').withDefault([]),
  );
  const [atmosphereParam] = useQueryState(
    'atmospheres',
    parseAsArrayOf(parseAsString, ',').withDefault([]),
  );

  const [keyParam] = useQueryState(
    'key',
    parseAsArrayOf(parseAsString, ',').withDefault([]),
  );

  const [tempoParam] = useQueryState(
    'tempo',
    parseAsArrayOf(parseAsInteger, ',').withDefault([]),
  );

  const [valenceMoodParam] = useQueryState(
    'valenceMood',
    parseAsArrayOf(parseAsString, ',').withDefault([]),
  );

  const [arousalMoodParam] = useQueryState(
    'arousalMood',
    parseAsArrayOf(parseAsString, ',').withDefault([]),
  );

  const [danceabilityFeelingParam] = useQueryState(
    'danceabilityFeeling',
    parseAsArrayOf(parseAsString, ',').withDefault([]),
  );

  const [libraryIdParam] = useQueryState(
    'libraryId',
    parseAsArrayOf(parseAsString, ',').withDefault([]),
  );

  // Use refs to track previous values and only update when they actually change
  const prevValuesRef = useRef<{
    artist: string | null;
    title: string | null;
    genres: string[];
    subgenres: string[];
    atmospheres: string[];
    keys: string[];
    tempo: number[];
    valenceMood: string | string[];
    arousalMood: string | string[];
    danceabilityFeeling: string | string[];
    libraryId: string[];
  }>({
    artist: null,
    title: null,
    genres: [],
    subgenres: [],
    atmospheres: [],
    keys: [],
    tempo: [],
    valenceMood: [],
    arousalMood: [],
    danceabilityFeeling: [],
    libraryId: [],
  });

  // Helper to compare arrays
  const arraysEqual = (a: string[] | number[], b: string[] | number[]) => {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  };

  useEffect(() => {
    console.log('artistParam', artistParam, genreParam);

    // Only update artist if it changed
    const artistValue = artistParam || '';
    if (prevValuesRef.current.artist !== artistValue) {
      updateFilter('artist', artistValue);
      prevValuesRef.current.artist = artistValue;
    }

    // Only update title if it changed
    const titleValue = titleParam || '';
    if (prevValuesRef.current.title !== titleValue) {
      updateFilter('title', titleValue);
      prevValuesRef.current.title = titleValue;
    }

    // Only update atmospheres if it changed
    if (!arraysEqual(prevValuesRef.current.atmospheres, atmosphereParam)) {
      updateFilter(
        'atmospheres',
        atmosphereParam.length > 0 ? atmosphereParam : [],
      );
      prevValuesRef.current.atmospheres = [...atmosphereParam];
    }

    // Only update genres if it changed
    if (!arraysEqual(prevValuesRef.current.genres, genreParam)) {
      updateFilter('genres', genreParam.length > 0 ? genreParam : []);
      prevValuesRef.current.genres = [...genreParam];
    }

    // Only update subgenres if it changed
    if (!arraysEqual(prevValuesRef.current.subgenres, subgenreParam)) {
      updateFilter('subgenres', subgenreParam.length > 0 ? subgenreParam : []);
      prevValuesRef.current.subgenres = [...subgenreParam];
    }

    // Only update keys if it changed
    if (!arraysEqual(prevValuesRef.current.keys, keyParam)) {
      updateFilter('keys', keyParam.length > 0 ? keyParam : []);
      prevValuesRef.current.keys = [...keyParam];
    }

    // Only update tempo if it changed
    if (!arraysEqual(prevValuesRef.current.tempo, tempoParam)) {
      updateFilter(
        'tempo',
        tempoParam.length > 0
          ? { min: tempoParam[0], max: tempoParam[1] }
          : { min: 0, max: 200 },
      );
      prevValuesRef.current.tempo = [...tempoParam];
    }

    // Only update valenceMood if it changed
    const valenceValue = Array.isArray(valenceMoodParam)
      ? valenceMoodParam
      : valenceMoodParam
        ? [valenceMoodParam]
        : [];
    if (
      !arraysEqual(prevValuesRef.current.valenceMood as string[], valenceValue)
    ) {
      updateFilter('valenceMood', valenceValue);
      prevValuesRef.current.valenceMood = [...valenceValue];
    }

    // Only update arousalMood if it changed
    const arousalValue = Array.isArray(arousalMoodParam)
      ? arousalMoodParam
      : arousalMoodParam
        ? [arousalMoodParam]
        : [];
    if (
      !arraysEqual(prevValuesRef.current.arousalMood as string[], arousalValue)
    ) {
      updateFilter('arousalMood', arousalValue);
      prevValuesRef.current.arousalMood = [...arousalValue];
    }

    // Only update danceabilityFeeling if it changed
    const danceabilityValue = Array.isArray(danceabilityFeelingParam)
      ? danceabilityFeelingParam
      : danceabilityFeelingParam
        ? [danceabilityFeelingParam]
        : [];
    if (
      !arraysEqual(
        prevValuesRef.current.danceabilityFeeling as string[],
        danceabilityValue,
      )
    ) {
      updateFilter('danceabilityFeeling', danceabilityValue);
      prevValuesRef.current.danceabilityFeeling = [...danceabilityValue];
    }

    // Only update libraryId if it changed
    if (!arraysEqual(prevValuesRef.current.libraryId, libraryIdParam)) {
      updateFilter(
        'libraryId',
        libraryIdParam.length > 0 ? libraryIdParam : [],
      );
      prevValuesRef.current.libraryId = [...libraryIdParam];
    }
  }, [
    titleParam,
    genreParam,
    subgenreParam,
    keyParam,
    tempoParam,
    valenceMoodParam,
    arousalMoodParam,
    danceabilityFeelingParam,
    artistParam,
    libraryIdParam,
    atmosphereParam,
    updateFilter,
  ]);

  // Debounce saveCurrentFilter to avoid saving on every filter change
  // Only save when filters actually change, not on every render
  const filtersRef = useRef(filters);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if filters actually changed by comparing stringified versions
    const filtersChanged =
      JSON.stringify(filtersRef.current) !== JSON.stringify(filters);

    if (filtersChanged) {
      filtersRef.current = filters;

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce the save operation
      saveTimeoutRef.current = setTimeout(() => {
        saveCurrentFilter();
      }, 500); // Wait 500ms after last filter change before saving
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [filters, saveCurrentFilter]);

  return {
    titleParam,
    genreParam,
    subgenreParam,
    keyParam,
    tempoParam,
    valenceMoodParam,
    arousalMoodParam,
    danceabilityFeelingParam,
    artistParam,
    atmosphereParam,
    isLoading,
  };
};
