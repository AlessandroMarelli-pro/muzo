import { StaticFilterOptions } from '@/__generated__/types';
import { useFilterOptions, useFilters } from '@/contexts/filter-context';
import { useStaticFilters } from '@/services/api-hooks';
import { useEffect } from 'react';

export type StaticFilterOptionsData = {
	[key in keyof StaticFilterOptions]: { label: string; value: string }[];
};

export function useFilterOptionsData(): StaticFilterOptionsData & {
	isLoading: boolean;
} {
	const { setOptions } = useFilterOptions();

	// Use the real API hook instead of mock data
	const { data: staticFiltersData, isLoading } = useStaticFilters();
	// Update filter options when data is loaded
	useEffect(() => {
		if (staticFiltersData) {
			setOptions({
				genres: staticFiltersData.genres.map((genre) => ({
					label: genre.name,
					value: genre.id,
				})),
				subgenres: staticFiltersData.subgenres.map((subgenre) => ({
					label: subgenre.name,
					value: subgenre.id,
				})),
				keys: staticFiltersData.keys.map((key) => ({
					label: key.name,
					value: key.id,
				})),
				libraries: staticFiltersData.libraries.map((library) => ({
					label: library.name,
					value: library.id,
				})),
				atmospheres: staticFiltersData.atmospheres.map((atmosphere) => ({
					label: atmosphere.name,
					value: atmosphere.id,
				})),
			});
		}
	}, [staticFiltersData, setOptions]);

	return {
		isLoading,
		genres:
			staticFiltersData?.genres.map((genre) => ({
				label: genre.name,
				value: genre.id,
			})) || [],
		subgenres:
			staticFiltersData?.subgenres.map((subgenre) => ({
				label: subgenre.name,
				value: subgenre.id,
			})) || [],
		keys:
			staticFiltersData?.keys.map((key) => ({
				label: key.name,
				value: key.id,
			})) || [],
		libraries:
			staticFiltersData?.libraries.map((library) => ({
				label: library.name,
				value: library.id,
			})) || [],
		atmospheres:
			staticFiltersData?.atmospheres.map((atmosphere) => ({
				label: atmosphere.name,
				value: atmosphere.id,
			})) || [],
	};
}

// Hook to apply filters to track queries
export function useFilteredTracksQuery(baseQuery: any) {
	const { filters } = useFilters();

	return {
		...baseQuery,
		queryKey: [...baseQuery.queryKey, 'filtered', filters],
		// Add filter logic here when integrating with actual API
		// This would typically modify the query parameters
	};
}
