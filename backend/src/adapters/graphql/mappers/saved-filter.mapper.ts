import { FilterCriteria, SavedFilter } from 'src/kernel/types';
import { FilterCriteriaType } from '../schema/saved-filter.schema';

export const toFilterCriteria = (
  criteria: FilterCriteria,
): FilterCriteriaType => {
  return {
    genreIds: criteria.genreIds ?? [],
    subgenreIds: criteria.subgenreIds ?? [],
    keyIds: criteria.keyIds ?? [],
    libraryIds: criteria.libraryIds ?? [],
    atmosphereIds: criteria.atmosphereIds ?? [],
    tempo: criteria.tempo ?? undefined,
    valenceMood: criteria.valenceMood ?? undefined,
    arousalMood: criteria.arousalMood ?? undefined,
    danceabilityFeeling: criteria.danceabilityFeeling ?? undefined,
    speechiness: criteria.speechiness ?? undefined,
    instrumentalness: criteria.instrumentalness ?? undefined,
    liveness: criteria.liveness ?? undefined,
    acousticness: criteria.acousticness ?? undefined,
    artist: criteria.artist ?? undefined,
    title: criteria.title ?? undefined,
  };
};

export const toFilter = (savedFilter: SavedFilter) => {
  return {
    criteria: toFilterCriteria(savedFilter.criteria),
    name: savedFilter.name,
    id: savedFilter.id,
  };
};
