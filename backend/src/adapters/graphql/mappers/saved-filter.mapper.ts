import { FilterCriteria, SavedFilter } from 'src/kernel/types';
import { FilterCriteriaType } from '../schema/saved-filter.schema';

export const toFilterCriteria = (
  criteria: FilterCriteria,
): FilterCriteriaType => {
  return {
    genreIds: criteria.genreIds,
    subgenreIds: criteria.subgenreIds,
    keyIds: criteria.keyIds,
    libraryIds: criteria.libraryIds,
    atmosphereIds: criteria.atmosphereIds,
    tempo: criteria.tempo,
    valenceMood: criteria.valenceMood,
    arousalMood: criteria.arousalMood,
    danceabilityFeeling: criteria.danceabilityFeeling,
    speechiness: criteria.speechiness,
    instrumentalness: criteria.instrumentalness,
    liveness: criteria.liveness,
    acousticness: criteria.acousticness,
    artist: criteria.artist,
    title: criteria.title,
  };
};

export const toFilter = (savedFilter: SavedFilter) => {
  if (!savedFilter) return null;
  return {
    criteria: toFilterCriteria(savedFilter.criteria),
    name: savedFilter.name,
    id: savedFilter.id,
  };
};
