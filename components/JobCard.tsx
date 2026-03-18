import React, { memo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Code,
  Globe,
  Cloud,
  Database,
  Shield,
  Zap,
  Package,
  GitBranch,
  Server,
  Layers,
  Cpu,
  Command,
  MapPin,
  Clock,
  Heart,
  Loader2,
} from 'lucide-react';
import { formatSalaryRange } from '@/lib/utils';
import type { CompanyProfile } from '@/types/company';
import { useAuth } from '@/lib/auth-context';

interface JobCardProps {
  id?: string;
  title: string;
  company?: string;
  company_name?: string;
  tags?: string[];
  salary?: string;
  salary_range?: {
    min: number;
    max: number;
    currency?: string;
  };
  applyUrl?: string;
  apply_url?: string;
  location?: string;
  type?: string;
  description?: string;
  companyProfile?: CompanyProfile;
  onFavoriteToggle?: () => void;
  isFavorited?: boolean;
  isFavoriteLoading?: boolean;
  alreadyApplied?: boolean;
}

// Map technology names to icons
const TECH_ICONS: Record<string, React.ReactNode> = {
  'Python': <Code className="w-4 h-4" />,
  'JavaScript': <Code className="w-4 h-4" />,
  'TypeScript': <Code className="w-4 h-4" />,
  'React': <Layers className="w-4 h-4" />,
  'Node.js': <Server className="w-4 h-4" />,
  'Docker': <Package className="w-4 h-4" />,
  'Kubernetes': <Package className="w-4 h-4" />,
  'AWS': <Cloud className="w-4 h-4" />,
  'PostgreSQL': <Database className="w-4 h-4" />,
  'MongoDB': <Database className="w-4 h-4" />,
  'Security': <Shield className="w-4 h-4" />,
  'Rust': <Zap className="w-4 h-4" />,
  'Go': <Zap className="w-4 h-4" />,
  'Git': <GitBranch className="w-4 h-4" />,
  'DevOps': <Server className="w-4 h-4" />,
  'Terraform': <Cloud className="w-4 h-4" />,
  'Linux': <Command className="w-4 h-4" />,
  'ML Ops': <Cpu className="w-4 h-4" />,
  'TensorFlow': <Cpu className="w-4 h-4" />,
  'Design Systems': <Layers className="w-4 h-4" />,
  'Remote': <Globe className="w-4 h-4" />,
  'Hybrid': <MapPin className="w-4 h-4" />,
  'On-site': <MapPin className="w-4 h-4" />,
};

/**
 * Individual Job Card Component
 * Displays job information with tech stack icons and apply button
 */
const JobCardComponent: React.FC<JobCardProps> = ({
  id,
  title,
  company,
  company_name,
  tags,
  salary,
  salary_range,
  applyUrl,
  apply_url,
  location = 'Remote',
  type = 'Full-time',
  description,
  companyProfile,
  onFavoriteToggle,
  isFavorited = false,
  isFavoriteLoading = false,
  alreadyApplied = false,
}) => {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const displayCompany = company || company_name || 'Unknown Company';
  const displayApplyUrl = applyUrl || apply_url || '#';
  const displayTags = tags || [];
  const displaySalary = salary || (
    salary_range
      ? formatSalaryRange(salary_range.min || 0, salary_range.max || 0, salary_range.currency || 'USD')
      : 'Not specified'
  );

  const getTechIcon = (tech: string): React.ReactNode => {
    return TECH_ICONS[tech] || <Code className="w-4 h-4" />;
  };
  const displayCurrency = salary_range?.currency || 'USD';
  const displaySymbol = displayCurrency === 'GBP' ? '£' : '$';
  const displayLocale = displayCurrency === 'GBP' ? 'en-GB' : 'en-US';
  const salaryMin = salary_range?.min ?? 0;
  const salaryMax = salary_range?.max ?? 0;
  const hasStructuredSalary = Boolean(salary_range && (salaryMin || salaryMax));
  const compactSalary = hasStructuredSalary
    ? `${displaySymbol}${Intl.NumberFormat(displayLocale, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(salaryMin)} - ${displaySymbol}${Intl.NumberFormat(displayLocale, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(salaryMax)}`
    : displaySalary;

  const handleApplyClick = () => {
    if (alreadyApplied) {
      return;
    }

    if (!isSignedIn) {
      const nextPath = id ? `/jobs/${id}` : '/';
      router.push(`/login/candidate?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    if (id) {
      router.push(`/jobs/${id}`);
      return;
    }

    window.open(displayApplyUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="job-card group h-full">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="job-title">{title}</h3>
          <p className="job-company">{displayCompany}</p>
        </div>
        {onFavoriteToggle && (
          <button
            type="button"
            onClick={onFavoriteToggle}
            disabled={isFavoriteLoading}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
              isFavorited
                ? 'border-neon-pink/60 bg-neon-pink/15 text-neon-pink'
                : 'border-glass-border text-foreground-muted hover:text-neon-pink'
            }`}
            aria-label={isFavorited ? 'Remove from saved jobs' : 'Save job'}
          >
            {isFavoriteLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
            )}
          </button>
        )}
      </div>

      {description && (
        <p className="text-sm text-foreground-muted mb-4 line-clamp-2">
          {description}
        </p>
      )}

      {(companyProfile?.website || companyProfile?.size || companyProfile?.location) && (
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-light">
          {companyProfile.website && (
            <a
              href={companyProfile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-electric-blue transition"
            >
              <Globe className="w-3 h-3" />
              Website
            </a>
          )}
          {companyProfile.size && <span>{companyProfile.size}</span>}
          {companyProfile.location && <span>{companyProfile.location}</span>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4 text-xs text-foreground-muted">
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {location}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {type}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs text-foreground-muted mb-2 font-semibold">Tech Stack</p>
        <div className="flex flex-wrap gap-2">
          {displayTags.map((tag, index) => (
            <div
              key={`${tag}-${index}`}
              className={`tag flex items-center gap-1.5 py-2 px-3 ${
                index % 3 === 1 ? 'tag-blue' : index % 3 === 2 ? 'tag-green' : ''
              }`}
              title={tag}
            >
              <span className="shrink-0">{getTechIcon(tag)}</span>
              <span className="text-xs font-medium">{tag}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto grid grid-cols-1 gap-3 border-t border-glass-border pt-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          {hasStructuredSalary ? (
            <>
              <p className="salary-range">{compactSalary}</p>
              <p className="text-xs font-semibold text-foreground-light">{displayCurrency}</p>
            </>
          ) : (
            <p className="salary-range text-base leading-tight">{displaySalary}</p>
          )}
        </div>
        <button
          className="btn-primary min-w-24 whitespace-nowrap text-sm py-2 px-4 disabled:opacity-60"
          type="button"
          onClick={handleApplyClick}
          disabled={alreadyApplied}
          aria-label={`Apply for ${title} position at ${displayCompany}`}
        >
          {alreadyApplied ? 'Applied' : 'Apply'}
        </button>
      </div>
    </div>
  );
};

// Memoize component for performance
export const JobCard = memo(JobCardComponent);

interface JobGridProps {
  jobs: JobCardProps[];
  className?: string;
}

/**
 * Responsive Job Grid Component
 * Displays multiple job cards in a responsive grid
 */
export const JobGrid: React.FC<JobGridProps> = ({ jobs, className }) => {
  if (!jobs || jobs.length === 0) {
    return null;
  }

  return (
    <div className={className || 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'}>
      {jobs.map((job, index) => (
        <JobCard key={`${job.company || job.company_name || 'company'}-${index}`} {...job} />
      ))}
    </div>
  );
};
