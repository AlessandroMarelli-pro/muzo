import {
	useCreateActiveFilter,
	useCurrentFilter,
	useDeleteActiveFilter,
	useUpdateActiveFilter,
} from '@/services/filter-hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface Range {
	min: number;
	max: number;
}

export interface FilterState {
	id: string | null;
	genreIds: string[];
	subgenreIds: string[];
	keyIds: string[];
	libraryIds: string[];
	atmosphereIds: string[];
	tempo: Range;
	speechiness: Range;
	instrumentalness: Range;
	liveness: Range;
	acousticness: Range;
	artist: string;
	title: string;
	valenceMood: string[];
	arousalMood: string[];
	danceabilityFeeling: string[];
}

export interface SavedFilterState {
	id: string | null;
	type: string | null;
	value: string | string[] | null;
	createdAt: string | null;
	isLoading: boolean;
	error: Error | null;
}

export interface FilterActions {
	// UI State Management
	updateFilter: <K extends keyof FilterState>(
		key: K,
		value: FilterState[K]
	) => void;
	updateFilters: (values: Record<string, any>) => void;
	resetFilters: () => void;

	// Utility
	hasActiveFilters: boolean;
}

export interface UseFilteringOptions {
	autoSave?: boolean;
	onSaveError?: (error: Error) => void;
}

const defaultFilterState: FilterState = {
	id: null,
	genreIds: [],
	subgenreIds: [],
	keyIds: [],
	tempo: { min: 0, max: 200 },
	valenceMood: [],
	arousalMood: [],
	danceabilityFeeling: [],
	speechiness: { min: 0, max: 1 },
	instrumentalness: { min: 0, max: 1 },
	liveness: { min: 0, max: 1 },
	acousticness: { min: 0, max: 1 },
	artist: '',
	title: '',
	libraryIds: [],
	atmosphereIds: [],
};

export const useFiltering = (options: UseFilteringOptions = {}) => {
	const { autoSave = false, onSaveError } = options;
	const currentFilter = useCurrentFilter();
	const updateActiveFilter = useUpdateActiveFilter();
	const createActiveFilter = useCreateActiveFilter();
	const deleteActiveFilter = useDeleteActiveFilter();
	const [filters, setFilters] = useState<FilterState>(defaultFilterState);
	const [isDirty, setIsDirty] = useState(false);

	const resetFilters = () => {
		console.log('resetFilters', filters.id);
		if (filters.id) {
			deleteActiveFilter.mutate(filters.id);
			setFilters(defaultFilterState);
			setIsDirty(false);
		}
	};

	const updateFilter = useCallback(
		<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
			setIsDirty(true);

			setFilters((prev) => ({
				...prev,
				[key]: value ?? defaultFilterState[key],
			}));
		},
		[]
	);

	const updateFilters = useCallback(
		(values: Record<string, any>) => {
			for (const [key, value] of Object.entries(values)) {
				const isString = typeof value === 'string';
				const isStringArray =
					Array.isArray(value) && value.every((v) => typeof v === 'string');
				const isMinMaxRange =
					Array.isArray(value) &&
					value.length === 2 &&
					value.every((v) => typeof v === 'number');

				if (value === null) {
					updateFilter(key as keyof FilterState, value);
				} else if (isString) {
					updateFilter(key as keyof FilterState, value as string);
				} else if (isStringArray) {
					updateFilter(key as keyof FilterState, value as string[]);
				} else if (isMinMaxRange) {
					updateFilter(
						key as keyof FilterState,
						{
							min: value[0],
							max: value[1],
						} as Range
					);
				}
			}
		},
		[updateFilter]
	);

	useEffect(() => {
		if (currentFilter.data) {
			setFilters({
				...currentFilter.data.criteria,
				id: currentFilter.data.id,
			});
		}
	}, [currentFilter.data]);

	useEffect(() => {
		console.log(
			'autoSave',
			autoSave,
			!currentFilter.isLoading,
			isDirty,
			filters
		);
		if (autoSave && !currentFilter.isLoading && isDirty) {
			const { id, ...criteria } = filters;
			if (id) {
				updateActiveFilter.mutate({
					id,
					criteria,
				});
			} else {
				createActiveFilter.mutate(criteria);
			}
		}
	}, [isDirty]);

	// Computed values
	const hasActiveFilters = useMemo(() => {
		const areFiltersActive =
			filters.genreIds.length > 0 ||
			filters.subgenreIds.length > 0 ||
			filters.keyIds.length > 0 ||
			filters.tempo.min !== 0 ||
			filters.tempo.max !== 200 ||
			filters.valenceMood.length > 0 ||
			filters.arousalMood.length > 0 ||
			filters.danceabilityFeeling.length > 0 ||
			filters.speechiness.min !== 0 ||
			filters.speechiness.max !== 1 ||
			filters.instrumentalness.min !== 0 ||
			filters.instrumentalness.max !== 1 ||
			filters.liveness.min !== 0 ||
			filters.liveness.max !== 1 ||
			filters.acousticness.min !== 0 ||
			filters.acousticness.max !== 1 ||
			filters.artist !== '' ||
			filters.title !== '' ||
			filters.libraryIds.length > 0 ||
			filters.atmosphereIds.length > 0;

		return areFiltersActive;
	}, [filters]);

	const actions: FilterActions = useMemo(
		() => ({
			updateFilter,
			updateFilters,
			resetFilters,
			hasActiveFilters,
		}),
		[updateFilter, updateFilters, resetFilters, hasActiveFilters]
	);

	return {
		// UI State
		filters,

		// Actions
		actions,
	};
};
