/**
 * Utility Functions
 * Reusable functions for common operations
 */

import { Job } from '@/types/job';
import { FilterState } from '@/components/SearchBar';

function normalize(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function classifyLocation(value: string | undefined): 'remote' | 'hybrid' | 'on-site' | 'unknown' {
  const location = normalize(value);
  if (!location) return 'unknown';
  if (location.includes('remote') || location.includes('anywhere')) return 'remote';
  if (location.includes('hybrid')) return 'hybrid';
  if (location.includes('on-site') || location.includes('onsite') || location.includes('office')) return 'on-site';
  return 'unknown';
}

function matchesCategory(job: Job, category: string): boolean {
  const content = `${job.title} ${job.description || ''} ${(job.tags || []).join(' ')}`.toLowerCase();
  const rules: Record<string, string[]> = {
    backend: ['backend', 'back-end', 'api', 'microservice', 'server'],
    frontend: ['frontend', 'front-end', 'ui', 'react', 'vue', 'angular'],
    fullstack: ['full stack', 'full-stack', 'fullstack'],
    devops: ['devops', 'platform', 'infrastructure', 'kubernetes', 'docker', 'terraform'],
    ml: ['machine learning', 'ml', 'ai', 'data science', 'model'],
    security: ['security', 'infosec', 'application security', 'cloud security'],
  };

  return (rules[category] || []).some((keyword) => content.includes(keyword));
}

/**
 * Filters jobs based on search query and filter criteria
 */
export function filterJobs(jobs: Job[], filters: FilterState): Job[] {
  return jobs.filter((job) => {
    // Text search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesTitle = job.title.toLowerCase().includes(query);
      const matchesCompany = job.company_name.toLowerCase().includes(query);
      const matchesTags = job.tags.some((tag) => tag.toLowerCase().includes(query));

      if (!matchesTitle && !matchesCompany && !matchesTags) {
        return false;
      }
    }

    if (filters.category && !matchesCategory(job, filters.category)) {
      return false;
    }

    if (filters.searchLocation) {
      const locationQuery = filters.searchLocation.toLowerCase();
      const jobLocation = (job.location || '').toLowerCase();
      if (!jobLocation.includes(locationQuery)) {
        return false;
      }
    }

    // Job type filter
    if (filters.type) {
      const jobType = normalize(job.type) || 'full-time';
      if (jobType !== filters.type) {
        return false;
      }
    }

    const locationKind = classifyLocation(job.location);
    const remoteEnforced = filters.remoteOnly || filters.location === 'remote';

    if (remoteEnforced && locationKind !== 'remote') {
      return false;
    }

    // Location filter (only when not in remote-only mode)
    if (filters.location && !remoteEnforced) {
      if (locationKind !== filters.location) {
        return false;
      }
    }

    if (filters.techStack) {
      const stack = filters.techStack.toLowerCase();
      const hasStack = job.tags.some((tag) => tag.toLowerCase().includes(stack));
      if (!hasStack) {
        return false;
      }
    }

    if (filters.salaryCurrency) {
      const currency = normalize(job.salary_range?.currency).toUpperCase();
      if (currency !== filters.salaryCurrency.toUpperCase()) {
        return false;
      }
    }

    if (filters.postedDate) {
      const postedAt = Date.parse(job.created_at);
      if (Number.isNaN(postedAt)) {
        return false;
      }
      const now = Date.now();
      const limits: Record<string, number> = {
        '1d': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      const maxAge = limits[filters.postedDate];
      if (maxAge && now - postedAt > maxAge) {
        return false;
      }
    }

    if (filters.experienceLevel) {
      const level = filters.experienceLevel.toLowerCase();
      const title = job.title.toLowerCase();
      const description = (job.description || '').toLowerCase();
      const expBlob = `${title} ${description}`;
      const matchesLevel =
        (level === 'junior' && (expBlob.includes('junior') || expBlob.includes('entry'))) ||
        (level === 'mid' && (expBlob.includes('mid') || expBlob.includes('intermediate'))) ||
        (level === 'senior' && expBlob.includes('senior')) ||
        (level === 'lead' && (expBlob.includes('lead') || expBlob.includes('principal') || expBlob.includes('staff')));

      if (!matchesLevel) {
        return false;
      }
    }

    // Salary range filter
    if (filters.salary) {
      const min = extractMinSalary(job.salary_range);
      if (!isWithinSalaryRange(min, filters.salary)) {
        return false;
      }
    }

    return true;
  });
}

function relevanceScore(job: Job, query: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 0;

  let score = 0;
  const title = job.title.toLowerCase();
  const company = job.company_name.toLowerCase();
  const description = (job.description || '').toLowerCase();
  const tags = (job.tags || []).map((tag) => tag.toLowerCase());

  if (title === normalizedQuery) score += 120;
  if (title.includes(normalizedQuery)) score += 70;
  if (company.includes(normalizedQuery)) score += 35;
  if (description.includes(normalizedQuery)) score += 20;
  if (tags.some((tag) => tag.includes(normalizedQuery))) score += 40;

  return score;
}

export function sortJobs(jobs: Job[], sortBy: string, searchQuery?: string): Job[] {
  const nextJobs = [...jobs];

  if (sortBy === 'salary_desc') {
    return nextJobs.sort((a, b) => {
      const aSalary = extractMinSalary(a.salary_range);
      const bSalary = extractMinSalary(b.salary_range);
      if (bSalary !== aSalary) return bSalary - aSalary;
      return Date.parse(b.created_at) - Date.parse(a.created_at);
    });
  }

  if (sortBy === 'relevance') {
    return nextJobs.sort((a, b) => {
      const byRelevance = relevanceScore(b, searchQuery || '') - relevanceScore(a, searchQuery || '');
      if (byRelevance !== 0) return byRelevance;
      return Date.parse(b.created_at) - Date.parse(a.created_at);
    });
  }

  return nextJobs.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

/**
 * Extracts minimum salary from salary range string
 */
export function extractMinSalary(salaryStrOrRange: string | { min: number; max: number; currency?: string }): number {
  if (typeof salaryStrOrRange === 'string') {
    const match = salaryStrOrRange.match(/[£$]?([\d,]+)/);
    return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
  }

  // it's a salary_range object
  return typeof salaryStrOrRange?.min === 'number' ? salaryStrOrRange.min : 0;
}

/**
 * Checks if salary is within specified range
 */
export function isWithinSalaryRange(salary: number, range: string): boolean {
  const [min, max] = range.split('-').map(Number);

  if (max === undefined) {
    return salary >= min; // Range like "200+"
  }

  return salary >= min && salary <= max;
}

/**
 * Formats salary range for display
 */
export function formatSalaryRange(min: number, max: number, currency = 'USD'): string {
  const locale = currency === 'GBP' ? 'en-GB' : 'en-US';
  const symbol = currency === 'GBP' ? '£' : '$';
  return `${symbol}${min.toLocaleString(locale)} - ${symbol}${max.toLocaleString(locale)} ${currency}`;
}

/**
 * Truncates text to specified length
 */
export function truncateText(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

/**
 * Validates job object
 */
export function validateJob(job: unknown): job is Job {
  if (typeof job !== 'object' || job === null) return false;
  const candidate = job as Partial<Job>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.company_name === 'string' &&
    Array.isArray(candidate.tags) &&
    typeof candidate.apply_url === 'string' &&
    typeof candidate.salary_range === 'object' &&
    candidate.salary_range !== null &&
    typeof candidate.salary_range.min === 'number' &&
    typeof candidate.salary_range.max === 'number'
  );
}

/**
 * Gets initials from company name
 */
export function getCompanyInitials(companyName: string): string {
  return companyName
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

/**
 * Formats date to readable string
 */
export function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Debounce function for search input
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Checks if URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
