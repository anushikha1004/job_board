import React, { useState, useCallback } from 'react';
import { Search, Filter, X } from 'lucide-react';
import {
  SALARY_RANGES,
  JOB_CATEGORIES,
  JOB_TYPES,
  JOB_LOCATIONS,
  EXPERIENCE_LEVELS,
  TECH_STACK_OPTIONS,
  SALARY_CURRENCIES,
  POSTED_DATE_OPTIONS,
  SORT_OPTIONS,
  MESSAGES,
} from '@/lib/constants';

interface SearchBarProps {
  onSearch?: (query: string) => void;
  onFilterChange?: (filters: FilterState) => void;
  isLoading?: boolean;
  initialFilters?: Partial<FilterState>;
  sidebarMode?: boolean;
  advancedOnly?: boolean;
}

export interface FilterState {
  searchQuery: string;
  searchLocation: string;
  category: string;
  salary: string;
  type: string;
  location: string;
  experienceLevel: string;
  techStack: string;
  salaryCurrency: string;
  postedDate: string;
  remoteOnly: boolean;
  sortBy: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch, 
  onFilterChange,
  isLoading = false,
  initialFilters,
  sidebarMode = false,
  advancedOnly = false,
}) => {
  const [showFilters, setShowFilters] = useState(false);
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

  const handleFilterChange = useCallback((
    key: keyof FilterState,
    value: string
  ) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  }, [filters, onFilterChange]);

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'sortBy') return value !== 'newest';
    if (key === 'remoteOnly') return value === true;
    return value !== '';
  });
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'sortBy') return value !== 'newest';
    if (key === 'remoteOnly') return value === true;
    return value !== '';
  }).length;

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
    setFilters(emptyFilters);
    onFilterChange?.(emptyFilters);
  }, [onFilterChange]);

  return (
    <div className={`glass rounded-2xl p-5 md:p-6 space-y-4 ${sidebarMode ? '' : 'mb-8'}`}>
      {/* Search Input */}
      {!advancedOnly && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-foreground-muted pointer-events-none" />
          <input
            type="text"
            placeholder={MESSAGES.searchPlaceholder}
            value={filters.searchQuery}
            onChange={(e) => {
              const value = e.target.value;
              const newFilters = { ...filters, searchQuery: value };
              setFilters(newFilters);
              onSearch?.(value);
              onFilterChange?.(newFilters);
            }}
            disabled={isLoading}
            className="w-full bg-glass-background border border-glass-border rounded-lg pl-12 pr-4 py-3 text-foreground placeholder-foreground-muted focus:outline-none focus:border-cyber-purple focus:ring-2 focus:ring-cyber-purple/20 transition disabled:opacity-50"
          />
        </div>
      )}

      {/* Filter Toggle */}
      {!sidebarMode && !advancedOnly && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-foreground-muted hover:text-cyber-purple transition"
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filters</span>
            {hasActiveFilters && (
              <span className="bg-cyber-purple text-background text-xs px-2 py-0.5 rounded-full font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-foreground-muted hover:text-neon-pink transition"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      )}

      {(sidebarMode || advancedOnly) && (
        <div className="flex items-center justify-between border-b border-glass-border pb-3">
          <div className="flex items-center gap-2 text-foreground-muted">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-semibold">Filters</span>
            {hasActiveFilters && (
              <span className="bg-cyber-purple text-background text-xs px-2 py-0.5 rounded-full font-semibold">
                {activeFilterCount}
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-foreground-muted hover:text-neon-pink transition"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Filter Options */}
      {(sidebarMode || showFilters) && (
        <div className={`grid grid-cols-1 gap-4 ${sidebarMode ? '' : 'md:grid-cols-3 lg:grid-cols-5'} ${sidebarMode ? 'pt-1' : 'pt-4 border-t border-glass-border'}`}>
          {/* Category Filter */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Category</label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              disabled={isLoading}
              className="w-full bg-glass-background border border-glass-border rounded-lg px-4 py-2 text-foreground text-sm focus:outline-none focus:border-cyber-purple focus:ring-2 focus:ring-cyber-purple/20 transition disabled:opacity-50"
            >
              {JOB_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Salary Filter */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Salary Range</label>
            <select
              value={filters.salary}
              onChange={(e) => handleFilterChange('salary', e.target.value)}
              disabled={isLoading}
              className="w-full bg-glass-background border border-glass-border rounded-lg px-4 py-2 text-foreground text-sm focus:outline-none focus:border-cyber-purple focus:ring-2 focus:ring-cyber-purple/20 transition disabled:opacity-50"
            >
              {SALARY_RANGES.map(range => (
                <option key={range.value} value={range.value}>{range.label}</option>
              ))}
            </select>
          </div>

          {/* Job Type Filter */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Job Type</label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              disabled={isLoading}
              className="w-full bg-glass-background border border-glass-border rounded-lg px-4 py-2 text-foreground text-sm focus:outline-none focus:border-cyber-purple focus:ring-2 focus:ring-cyber-purple/20 transition disabled:opacity-50"
            >
              {JOB_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Location Filter */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Location</label>
            <select
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              disabled={isLoading}
              className="w-full bg-glass-background border border-glass-border rounded-lg px-4 py-2 text-foreground text-sm focus:outline-none focus:border-cyber-purple focus:ring-2 focus:ring-cyber-purple/20 transition disabled:opacity-50"
            >
              {JOB_LOCATIONS.map((location) => (
                <option key={location.value} value={location.value}>{location.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Experience</label>
            <select
              value={filters.experienceLevel}
              onChange={(e) => handleFilterChange('experienceLevel', e.target.value)}
              disabled={isLoading}
              className="w-full bg-glass-background border border-glass-border rounded-lg px-4 py-2 text-foreground text-sm focus:outline-none focus:border-cyber-purple focus:ring-2 focus:ring-cyber-purple/20 transition disabled:opacity-50"
            >
              {EXPERIENCE_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>{level.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Tech Stack</label>
            <select
              value={filters.techStack}
              onChange={(e) => handleFilterChange('techStack', e.target.value)}
              disabled={isLoading}
              className="w-full bg-glass-background border border-glass-border rounded-lg px-4 py-2 text-foreground text-sm focus:outline-none focus:border-cyber-purple focus:ring-2 focus:ring-cyber-purple/20 transition disabled:opacity-50"
            >
              {TECH_STACK_OPTIONS.map((stack) => (
                <option key={stack.value} value={stack.value}>{stack.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Currency</label>
            <select
              value={filters.salaryCurrency}
              onChange={(e) => handleFilterChange('salaryCurrency', e.target.value)}
              disabled={isLoading}
              className="w-full bg-glass-background border border-glass-border rounded-lg px-4 py-2 text-foreground text-sm focus:outline-none focus:border-cyber-purple focus:ring-2 focus:ring-cyber-purple/20 transition disabled:opacity-50"
            >
              {SALARY_CURRENCIES.map((currency) => (
                <option key={currency.value} value={currency.value}>{currency.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Posted Date</label>
            <select
              value={filters.postedDate}
              onChange={(e) => handleFilterChange('postedDate', e.target.value)}
              disabled={isLoading}
              className="w-full bg-glass-background border border-glass-border rounded-lg px-4 py-2 text-foreground text-sm focus:outline-none focus:border-cyber-purple focus:ring-2 focus:ring-cyber-purple/20 transition disabled:opacity-50"
            >
              {POSTED_DATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Remote Only</label>
            <label className="flex items-center gap-2 rounded-lg border border-glass-border px-3 py-2 text-sm text-foreground-light">
              <input
                type="checkbox"
                checked={filters.remoteOnly}
                onChange={(e) => {
                  const newFilters = { ...filters, remoteOnly: e.target.checked };
                  setFilters(newFilters);
                  onFilterChange?.(newFilters);
                }}
                className="h-4 w-4"
              />
              Show remote jobs only
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Sort</label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              disabled={isLoading}
              className="w-full bg-glass-background border border-glass-border rounded-lg px-4 py-2 text-foreground text-sm focus:outline-none focus:border-cyber-purple focus:ring-2 focus:ring-cyber-purple/20 transition disabled:opacity-50"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
