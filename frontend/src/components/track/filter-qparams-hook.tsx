import { useFilters } from '@/contexts/filter-context';
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  useQueryState,
} from 'nuqs';
import { useEffect } from 'react';

export const useFilterQueryParams = () => {
  // Filter state management
  const { filters, updateFilter, saveCurrentFilter } = useFilters();

  // URL query parameter management for filters (read-only)
  const [artistParam] = useQueryState('artist', parseAsString);
  const [genreParam] = useQueryState(
    'genre',
    parseAsArrayOf(parseAsString, ',').withDefault([]),
  );

  const [subgenreParam] = useQueryState(
    'subgenre',
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
    parseAsStringEnum([
      'very positive',
      'positive',
      'neutral',
      'negative',
      'very negative',
    ]).withDefault([]),
  );

  const [arousalMoodParam] = useQueryState(
    'arousalMood',
    parseAsStringEnum([
      'very calm',
      'calm',
      'moderate energy',
      'energetic',
      'very energetic',
    ]).withDefault([]),
  );

  const [danceabilityFeelingParam] = useQueryState(
    'danceabilityFeeling',
    parseAsStringEnum([
      'highly-danceable',
      'danceable',
      'moderately-danceable',
      'slightly-danceable',
      'minimally-danceable',
      'ambient',
      'experimental',
    ]).withDefault([]),
  );

  useEffect(() => {
    console.log('artistParam', artistParam);
    if (artistParam && artistParam.length > 0) {
      updateFilter('artist', artistParam);
    } else {
      updateFilter('artist', '');
    }
    if (genreParam.length > 0) {
      updateFilter('genres', genreParam);
    } else {
      updateFilter('genres', []);
    }
    if (subgenreParam.length > 0) {
      updateFilter('subgenres', subgenreParam);
    } else {
      updateFilter('subgenres', []);
    }
    if (keyParam.length > 0) {
      updateFilter('keys', keyParam);
    } else {
      updateFilter('keys', []);
    }
    if (tempoParam.length > 0) {
      updateFilter('tempo', { min: tempoParam[0], max: tempoParam[1] });
    } else {
      updateFilter('tempo', { min: 0, max: 200 });
    }

    if (valenceMoodParam.length > 0) {
      updateFilter('valenceMood', valenceMoodParam);
    } else {
      updateFilter('valenceMood', []);
    }
    if (arousalMoodParam?.length > 0) {
      updateFilter('arousalMood', arousalMoodParam);
    } else {
      updateFilter('arousalMood', []);
    }
    if (danceabilityFeelingParam?.length > 0) {
      updateFilter('danceabilityFeeling', danceabilityFeelingParam);
    } else {
      updateFilter('danceabilityFeeling', []);
    }
  }, [
    genreParam,
    subgenreParam,
    keyParam,
    tempoParam,
    valenceMoodParam,
    arousalMoodParam,
    danceabilityFeelingParam,
    artistParam,
  ]);

  useEffect(() => {
    saveCurrentFilter();
  }, [filters]);

  return {
    genreParam,
    subgenreParam,
    keyParam,
    tempoParam,
    valenceMoodParam,
    arousalMoodParam,
    danceabilityFeelingParam,
    artistParam,
  };
};
