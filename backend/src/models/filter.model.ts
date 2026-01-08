// Updated to include new audio features: speechiness, instrumentalness, liveness, acousticness
export interface FilterCriteria {
  genres?: string[];
  subgenres?: string[];
  keys?: string[];
  tempo?: { min?: number; max?: number };
  valenceMood?: string[];
  arousalMood?: string[];
  danceabilityFeeling?: string[];
  speechiness?: { min?: number; max?: number };
  instrumentalness?: { min?: number; max?: number };
  liveness?: { min?: number; max?: number };
  acousticness?: { min?: number; max?: number };
  artist?: string;
  libraryId?: string[];
}

export interface SavedFilter {
  id: string;
  name: string;
  criteria: FilterCriteria;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFilterDto {
  name: string;
  criteria: FilterCriteria;
}

export interface UpdateFilterDto {
  name?: string;
  criteria?: FilterCriteria;
}
export interface LibraryFilterOption {
  id: string;
  name: string;
}

export interface StaticFilterOptions {
  genres: string[];
  subgenres: string[];
  keys: string[];
  libraries: LibraryFilterOption[];
}

export interface FilterOptions {
  tempoRange: { min: number; max: number };
  speechinessRange: { min: number; max: number };
  instrumentalnessRange: { min: number; max: number };
  livenessRange: { min: number; max: number };
  acousticnessRange: { min: number; max: number };
}
