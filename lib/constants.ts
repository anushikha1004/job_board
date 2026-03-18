/**
 * Application Constants
 * Centralized configuration and constants for the job board
 */

// API & Environment
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
export const ENVIRONMENT = process.env.NODE_ENV || 'development';

// Pagination
export const JOBS_PER_PAGE = 12;
export const DEFAULT_PAGE = 1;

// Filtering
export const SALARY_RANGES = [
  { label: 'All Ranges', value: '' },
  { label: '£0 - £80K', value: '0-80' },
  { label: '£80K - £120K', value: '80-120' },
  { label: '£120K - £160K', value: '120-160' },
  { label: '£160K - £200K', value: '160-200' },
  { label: '£200K+', value: '200+' },
] as const;

export const JOB_CATEGORIES = [
  { label: 'All Categories', value: '' },
  { label: 'Backend', value: 'backend' },
  { label: 'Frontend', value: 'frontend' },
  { label: 'Full Stack', value: 'fullstack' },
  { label: 'DevOps', value: 'devops' },
  { label: 'Machine Learning', value: 'ml' },
  { label: 'Security', value: 'security' },
] as const;

export const JOB_TYPES = [
  { label: 'All Types', value: '' },
  { label: 'Full-time', value: 'full-time' },
  { label: 'Part-time', value: 'part-time' },
  { label: 'Contract', value: 'contract' },
  { label: 'Freelance', value: 'freelance' },
] as const;

export const JOB_LOCATIONS = [
  { label: 'All Locations', value: '' },
  { label: 'Remote', value: 'remote' },
  { label: 'Hybrid', value: 'hybrid' },
  { label: 'On-site', value: 'on-site' },
] as const;

export const EXPERIENCE_LEVELS = [
  { label: 'All Experience', value: '' },
  { label: 'Junior', value: 'junior' },
  { label: 'Mid', value: 'mid' },
  { label: 'Senior', value: 'senior' },
  { label: 'Lead', value: 'lead' },
] as const;

export const TECH_STACK_OPTIONS = [
  { label: 'All Stacks', value: '' },
  { label: 'React', value: 'react' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'Node.js', value: 'node.js' },
  { label: 'Python', value: 'python' },
  { label: 'AWS', value: 'aws' },
  { label: 'Docker', value: 'docker' },
  { label: 'Kubernetes', value: 'kubernetes' },
] as const;

export const SALARY_CURRENCIES = [
  { label: 'All Currencies', value: '' },
  { label: 'GBP', value: 'GBP' },
  { label: 'USD', value: 'USD' },
] as const;

export const POSTED_DATE_OPTIONS = [
  { label: 'Any Time', value: '' },
  { label: 'Last 24 Hours', value: '1d' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
] as const;

export const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Salary: High to Low', value: 'salary_desc' },
  { label: 'Relevance', value: 'relevance' },
] as const;

// Colors
export const COLORS = {
  background: '#0f172a',
  backgroundSecondary: '#1a1f3a',
  foreground: '#e2e8f0',
  foregroundMuted: '#94a3b8',
  cyberPurple: '#a78bfa',
  cyberPurpleDark: '#7c3aed',
  electricBlue: '#06b6d4',
  electricBlueDark: '#0891b2',
  neonGreen: '#4ade80',
  neonPink: '#ec4899',
} as const;

// Animation Durations (ms)
export const ANIMATION = {
  fast: 200,
  normal: 300,
  slow: 500,
} as const;

// Messages
export const MESSAGES = {
  noResults: 'No jobs found matching your criteria',
  searchPlaceholder: 'Search by job title, company, or skill...',
  error: 'Something went wrong. Please try again.',
  loading: 'Loading jobs...',
  success: 'Successfully applied!',
} as const;

// Links
export const SOCIAL_LINKS = {
  github: 'https://github.com',
  linkedin: 'https://linkedin.com',
} as const;

export const FOOTER_LINKS = [
  { label: 'Browse Jobs', href: '/candidate' },
  { label: 'Post a Job', href: '/company' },
  { label: 'Company', href: '/company' },
] as const;
