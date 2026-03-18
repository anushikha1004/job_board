/**
 * Custom Hooks
 * Reusable React hooks for common functionality
 */

import { useState, useCallback, useEffect } from 'react';
import { Job } from '@/types/job';
import { FilterState } from '@/components/SearchBar';
import { filterJobs } from '@/lib/utils';
import { getAllJobs } from '@/lib/firestore';

/**
 * Hook for fetching jobs from Firestore
 */
export function useFirestoreJobs(immediate = true) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(immediate);
  const [error, setError] = useState<Error | null>(null);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedJobs = await getAllJobs();
      setJobs(fetchedJobs);
      setIsLoading(false);
      return fetchedJobs;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch jobs');
      setError(error);
      setIsLoading(false);
      throw error;
    }
  }, []);

  useEffect(() => {
    if (immediate) {
      const id = setTimeout(() => {
        fetchJobs();
      }, 0);
      return () => clearTimeout(id);
    }
  }, [immediate, fetchJobs]);

  return { jobs, isLoading, error, refetch: fetchJobs };
}

/**
 * Hook for managing job filtering and search
 */
export function useJobFiltering(jobs: Job[], initialFilters?: FilterState) {
  const [filteredJobs, setFilteredJobs] = useState<Job[]>(jobs);
  const [filters, setFilters] = useState<FilterState>(() => ({
    searchQuery: initialFilters?.searchQuery || '',
    searchLocation: initialFilters?.searchLocation || '',
    category: initialFilters?.category || '',
    salary: initialFilters?.salary || '',
    type: initialFilters?.type || '',
    location: initialFilters?.location || '',
    experienceLevel: initialFilters?.experienceLevel || '',
    techStack: initialFilters?.techStack || '',
    salaryCurrency: initialFilters?.salaryCurrency || '',
    postedDate: initialFilters?.postedDate || '',
    remoteOnly: Boolean(initialFilters?.remoteOnly),
    sortBy: initialFilters?.sortBy || 'newest',
  }));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setFilteredJobs(filterJobs(jobs, filters));
  }, [jobs, filters]);

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setIsLoading(true);
    setFilters(newFilters);

    // Simulate filtering delay for better UX
    setTimeout(() => {
      setIsLoading(false);
    }, 100);
  }, []);

  const clearFilters = useCallback(() => {
    const emptyFilters: FilterState = {
      searchQuery: '',
      searchLocation: '',
      category: '',
      salary: '',
      type: '',
      location: '',
      experienceLevel: '',
      techStack: '',
      salaryCurrency: '',
      postedDate: '',
      remoteOnly: false,
      sortBy: 'newest',
    };
    handleFilterChange(emptyFilters);
  }, [handleFilterChange]);

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'remoteOnly') return value === true;
    return value !== '';
  });

  return {
    filteredJobs,
    filters,
    filterKey: JSON.stringify(filters),
    isLoading,
    handleFilterChange,
    clearFilters,
    hasActiveFilters,
    totalJobs: jobs.length,
    filteredCount: filteredJobs.length,
  };
}

/**
 * Hook for managing search with debouncing
 */
export function useDebouncedSearch(initialValue = '', delay = 300) {
  const [value, setValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return { value, setValue, debouncedValue };
}

/**
 * Hook for managing async data loading
 */
export function useAsync<T>(asyncFunction: () => Promise<T>, immediate = true) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setStatus('pending');
    setData(null);
    setError(null);
    try {
      const response = await asyncFunction();
      setData(response);
      setStatus('success');
      return response;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setStatus('error');
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      const id = setTimeout(() => {
        execute();
      }, 0);
      return () => clearTimeout(id);
    }
  }, [execute, immediate]);

  return { execute, status, data, error };
}

/**
 * Hook for managing pagination
 */
export function usePagination<T>(
  items: T[],
  itemsPerPage: number,
  resetKey?: string | number,
  initialPage = 1
) {
  const [paginationState, setPaginationState] = useState<{ page: number; resetKey?: string | number }>({
    page: Math.max(1, initialPage),
    resetKey,
  });

  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  const effectivePage = paginationState.resetKey === resetKey ? paginationState.page : 1;
  const safeCurrentPage = Math.min(effectivePage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = items.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    const pageNumber = Math.max(1, Math.min(page, totalPages));
    setPaginationState({ page: pageNumber, resetKey });
  };

  return {
    currentPage: safeCurrentPage,
    totalPages,
    currentItems,
    goToPage,
    nextPage: () => goToPage(safeCurrentPage + 1),
    prevPage: () => goToPage(safeCurrentPage - 1),
  };
}

/**
 * Hook for local storage
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') {
        return initialValue;
      }
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading from localStorage (${key}):`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error writing to localStorage (${key}):`, error);
    }
  };

  return [storedValue, setValue] as const;
}
