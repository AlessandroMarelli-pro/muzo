import { FilterCriteriaResult } from '@/__generated__/types';

export const toFilterState = (filter: FilterCriteriaResult) => {
  return {
    name: filter.name,
    criteria: {
      genres: filter.criteria.genreIds ?? [],
      subgenres: filter.criteria.subgenreIds ?? [],
      keyIds: filter.criteria.keyIds ?? [],
      library: filter.criteria.libraryIds ?? [],
      atmosphereIds: filter.criteria.atmosphereIds ?? [],
      tempo: filter.criteria.tempo ?? { min: 0, max: 200 },
      speechiness: filter.criteria.speechiness ?? { min: 0, max: 1 },
      instrumentalness: filter.criteria.instrumentalness ?? { min: 0, max: 1 },
      liveness: filter.criteria.liveness ?? { min: 0, max: 1 },
      acousticness: filter.criteria.acousticness ?? { min: 0, max: 1 },
      artist: filter.criteria.artist ?? '',
      title: filter.criteria.title ?? '',
      valenceMood: filter.criteria.valenceMood ?? [],
      arousalMood: filter.criteria.arousalMood ?? [],
      danceabilityFeeling: filter.criteria.danceabilityFeeling ?? [],
    },
    id: filter.id,
  };
};
