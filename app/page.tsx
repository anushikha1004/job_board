'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header, FeaturedSection } from '@/components/Layout';
import { JobGrid } from '@/components/JobCard';
import { SearchBar, type FilterState } from '@/components/SearchBar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingGrid } from '@/components/Loading';
import { useJobFiltering, useFirestoreJobs, usePagination } from '@/lib/hooks';
import { MESSAGES } from '@/lib/constants';
import { getCompanyProfilesByUserIds } from '@/lib/firestore';
import type { CompanyProfile } from '@/types/company';
import { sortJobs } from '@/lib/utils';
import { MapPin, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getCandidateApplications } from '@/lib/applications';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const DEFAULT_FILTERS: FilterState = {
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

function parseFiltersFromUrl(search: string): { filters: FilterState; page: number } {
  const params = new URLSearchParams(search);
  const parsedPage = Number(params.get('page') || '1');

  return {
    filters: {
      searchQuery: params.get('q') || '',
      searchLocation: params.get('qloc') || '',
      category: params.get('category') || '',
      salary: params.get('salary') || '',
      type: params.get('type') || '',
      location: params.get('location') || '',
      experienceLevel: params.get('exp') || '',
      techStack: params.get('stack') || '',
      salaryCurrency: params.get('currency') || '',
      postedDate: params.get('posted') || '',
      remoteOnly: params.get('remote') === '1',
      sortBy: params.get('sort') || 'newest',
    },
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

function buildUrlFromFilters(filters: FilterState, page: number): string {
  const params = new URLSearchParams();
  if (filters.searchQuery) params.set('q', filters.searchQuery);
  if (filters.searchLocation) params.set('qloc', filters.searchLocation);
  if (filters.category) params.set('category', filters.category);
  if (filters.salary) params.set('salary', filters.salary);
  if (filters.type) params.set('type', filters.type);
  if (filters.location) params.set('location', filters.location);
  if (filters.experienceLevel) params.set('exp', filters.experienceLevel);
  if (filters.techStack) params.set('stack', filters.techStack);
  if (filters.salaryCurrency) params.set('currency', filters.salaryCurrency);
  if (filters.postedDate) params.set('posted', filters.postedDate);
  if (filters.remoteOnly) params.set('remote', '1');
  if (filters.sortBy && filters.sortBy !== 'newest') params.set('sort', filters.sortBy);
  if (page > 1) params.set('page', String(page));

  const query = params.toString();
  return query ? `/?${query}` : '/';
}

function HomeContent() {
  const { user, isSignedIn } = useAuth();
  // Fetch jobs from Firebase
  const { jobs: firestoreJobs, isLoading: firestoreLoading } = useFirestoreJobs(true);
  const [companyProfiles, setCompanyProfiles] = useState<Record<string, CompanyProfile>>({});
  const [titleQueryInput, setTitleQueryInput] = useState('');
  const [locationQueryInput, setLocationQueryInput] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isUrlStateReady, setIsUrlStateReady] = useState(false);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [viewerRole, setViewerRole] = useState<'candidate' | 'company' | 'admin' | null>(null);
  const [showAppliedOnly, setShowAppliedOnly] = useState(false);

  const jobsToDisplay = firestoreJobs;

  const {
    filteredJobs,
    filterKey,
    isLoading,
    filters,
    handleFilterChange,
    clearFilters,
    filteredCount,
  } = useJobFiltering(jobsToDisplay, DEFAULT_FILTERS);

  // Show loading state while fetching from Firebase
  const showLoading = firestoreLoading || isLoading;
  const totalJobs = jobsToDisplay.length;

  useEffect(() => {
    const loadCompanyProfiles = async () => {
      const userIds = jobsToDisplay.map((job) => job.postedBy).filter((id): id is string => Boolean(id));
      const profiles = await getCompanyProfilesByUserIds(userIds);
      setCompanyProfiles(profiles);
    };
    loadCompanyProfiles();
  }, [jobsToDisplay]);

  useEffect(() => {
    const loadRole = async () => {
      if (!isSignedIn || !user) {
        setViewerRole(null);
        return;
      }
      try {
        const profileSnap = await getDoc(doc(db, 'user_profiles', user.uid));
        const role = profileSnap.data()?.role;
        if (role === 'admin') {
          setViewerRole('admin');
        } else {
          setViewerRole(role === 'company' ? 'company' : 'candidate');
        }
      } catch (error) {
        console.error('Home role load error:', error);
        setViewerRole(null);
      }
    };
    loadRole();
  }, [isSignedIn, user]);

  useEffect(() => {
    const loadAppliedJobs = async () => {
      if (!isSignedIn || !user || viewerRole !== 'candidate') {
        setAppliedJobIds(new Set());
        return;
      }
      try {
        const applications = await getCandidateApplications(user.uid);
        setAppliedJobIds(new Set(applications.map((item) => item.job_id)));
      } catch (error) {
        console.error('Home applied jobs load error:', error);
        setAppliedJobIds(new Set());
      }
    };
    loadAppliedJobs();
  }, [isSignedIn, user, viewerRole]);

  useEffect(() => {
    if (viewerRole !== 'candidate') {
      setShowAppliedOnly(false);
    }
  }, [viewerRole]);

  const sortedFilteredJobs = useMemo(
    () => sortJobs(filteredJobs, filters.sortBy, filters.searchQuery),
    [filteredJobs, filters.sortBy, filters.searchQuery]
  );
  const visibleJobs = useMemo(
    () => (showAppliedOnly ? sortedFilteredJobs.filter((job) => appliedJobIds.has(job.id)) : sortedFilteredJobs),
    [showAppliedOnly, sortedFilteredJobs, appliedJobIds]
  );
  const showSidebarFilters = hasSearched;

  const jobsWithCompanyProfiles = useMemo(
    () =>
      visibleJobs.map((job) => ({
        ...job,
        companyProfile: job.postedBy ? companyProfiles[job.postedBy] : undefined,
        alreadyApplied: Boolean(job.id && appliedJobIds.has(job.id)),
      })),
    [visibleJobs, companyProfiles, appliedJobIds]
  );
  const jobsStructuredData = useMemo(() => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://techhire.example.com';
    const items = visibleJobs.slice(0, 20).map((job) => ({
      '@type': 'JobPosting',
      title: job.title,
      description: job.description || `${job.title} at ${job.company_name}`,
      datePosted: job.created_at,
      employmentType: job.type || 'FULL_TIME',
      hiringOrganization: {
        '@type': 'Organization',
        name: job.company_name,
      },
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: job.location || 'Remote',
        },
      },
      baseSalary: {
        '@type': 'MonetaryAmount',
        currency: job.salary_range?.currency || 'USD',
        value: {
          '@type': 'QuantitativeValue',
          minValue: job.salary_range?.min || 0,
          maxValue: job.salary_range?.max || 0,
          unitText: 'YEAR',
        },
      },
      applicantLocationRequirements: {
        '@type': 'Country',
        name: 'Worldwide',
      },
      url: `${siteUrl}/jobs/${job.id}`,
    }));

    return JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': items,
    });
  }, [visibleJobs]);
  const {
    currentPage,
    totalPages,
    currentItems: paginatedJobs,
    goToPage,
    nextPage,
    prevPage,
  } = usePagination(jobsWithCompanyProfiles, 9, filterKey, 1);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const parsed = parseFiltersFromUrl(window.location.search);
    const parsedTitle = parsed.filters.searchQuery.trim();
    const parsedLocation = parsed.filters.searchLocation.trim();

    setTitleQueryInput(parsed.filters.searchQuery);
    setLocationQueryInput(parsed.filters.searchLocation);
    setHasSearched(Boolean(parsedTitle || parsedLocation));
    handleFilterChange(parsed.filters);
    if (parsed.page > 1) {
      goToPage(parsed.page);
    }
    setIsUrlStateReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isUrlStateReady) return;
    const nextUrl = buildUrlFromFilters(filters, currentPage);
    window.history.replaceState({}, '', nextUrl);
  }, [filters, currentPage, isUrlStateReady]);

  const handleTopSearch = () => {
    const normalizedTitle = titleQueryInput.trim();
    const normalizedLocation = locationQueryInput.trim();
    const nextFilters: FilterState = {
      ...filters,
      searchQuery: normalizedTitle,
      searchLocation: normalizedLocation,
    };
    handleFilterChange(nextFilters);
    setHasSearched(Boolean(normalizedTitle || normalizedLocation));
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jobsStructuredData }} />
      <Header />

      <main className="mx-auto w-full px-6 py-10 md:py-12 xl:px-12">
        <section className="mb-9 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-cyber-purple">
              Tech Hiring, Reimagined
            </p>
            <h2 className="max-w-4xl text-4xl font-black leading-[1.04] text-foreground md:text-6xl">
              Hire better engineers.
              <span className="block text-cyber-purple-dark">Get hired faster.</span>
            </h2>
            <p className="mt-4 max-w-3xl text-base text-foreground-muted md:text-xl">
              Verified roles for software, data, DevOps, AI, and product teams.
            </p>
          </div>
          <div className="glass rounded-2xl p-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-foreground-light">Platform Highlights</p>
            <div className="space-y-2 text-sm leading-relaxed text-foreground">
              <p>• Role-focused candidate and recruiter flows</p>
              <p>• Advanced filters and fast job discovery</p>
              <p>• Verified company job postings</p>
            </div>
          </div>
        </section>

        <section className="glass mb-7 rounded-2xl p-5 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">Job Title</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
                <input
                  type="text"
                  value={titleQueryInput}
                  onChange={(e) => setTitleQueryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleTopSearch();
                    }
                  }}
                  placeholder="e.g. Frontend Engineer"
                  className="w-full rounded-xl border border-glass-border bg-glass-background py-2.5 pl-10 pr-3 text-sm text-foreground outline-none focus:border-electric-blue focus:ring-2 focus:ring-electric-blue/20"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
                <input
                  type="text"
                  value={locationQueryInput}
                  onChange={(e) => setLocationQueryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleTopSearch();
                    }
                  }}
                  placeholder="e.g. London, Remote"
                  className="w-full rounded-xl border border-glass-border bg-glass-background py-2.5 pl-10 pr-3 text-sm text-foreground outline-none focus:border-electric-blue focus:ring-2 focus:ring-electric-blue/20"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleTopSearch}
              className="btn-primary h-10.5 px-5 text-sm"
            >
              Search Jobs
            </button>
          </div>
        </section>

        <section className={`grid grid-cols-1 items-start gap-6 ${showSidebarFilters ? 'lg:grid-cols-[320px_1fr]' : ''}`}>
          <aside className={showSidebarFilters ? 'lg:sticky lg:top-24' : ''}>
            {showSidebarFilters && (
              <SearchBar
                onFilterChange={handleFilterChange}
                isLoading={showLoading}
                initialFilters={filters}
                sidebarMode
                advancedOnly
              />
            )}
          </aside>

          <div>
            {viewerRole === 'candidate' && (
              <div className="mb-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAppliedOnly(false)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${showAppliedOnly ? 'border-glass-border text-foreground-light hover:border-electric-blue/45 hover:text-electric-blue' : 'border-electric-blue/45 bg-electric-blue/10 text-electric-blue'}`}
                >
                  All Jobs
                </button>
                <button
                  type="button"
                  onClick={() => setShowAppliedOnly(true)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${showAppliedOnly ? 'border-electric-blue/45 bg-electric-blue/10 text-electric-blue' : 'border-glass-border text-foreground-light hover:border-electric-blue/45 hover:text-electric-blue'}`}
                >
                  Applied Jobs
                </button>
              </div>
            )}
            <FeaturedSection>
              {showLoading ? (
                <LoadingGrid count={6} />
              ) : filteredJobs.length > 0 ? (
                <>
                  <JobGrid
                    jobs={paginatedJobs}
                    className={
                      showSidebarFilters
                        ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6'
                        : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                    }
                  />
                  <p className="text-center text-foreground-muted mt-8 text-sm">
                    Showing {filteredCount} of {totalJobs} jobs
                  </p>
                  {totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-center gap-2">
                      <button className="btn-secondary py-2 px-3 text-sm" onClick={prevPage} disabled={currentPage === 1}>
                        Prev
                      </button>
                      <span className="text-sm text-foreground-muted">Page {currentPage} of {totalPages}</span>
                      <button className="btn-secondary py-2 px-3 text-sm" onClick={nextPage} disabled={currentPage === totalPages}>
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="glass rounded-xl p-10 text-center">
                  <p className="text-foreground-muted text-lg mb-4">
                    {MESSAGES.noResults}
                  </p>
                  <button
                    onClick={() => {
                      clearFilters();
                      setTitleQueryInput('');
                      setLocationQueryInput('');
                      setHasSearched(false);
                    }}
                    className="btn-secondary"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </FeaturedSection>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="glass glass-heavy mt-16 py-8">
        <div className="mx-auto w-full px-6 xl:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h4 className="text-foreground font-semibold mb-4">About</h4>
              <p className="text-foreground-muted text-sm">
                TechHire is a focused hiring marketplace for software engineering, DevOps, data, AI, and product roles. We help candidates discover curated opportunities and help companies fill critical positions faster with qualified talent.
              </p>
              <Link href="/about" className="mt-3 inline-flex text-sm font-semibold text-cyber-purple hover:text-electric-blue transition">
                Read full About page
              </Link>
            </div>
            <div>
              <h4 className="text-foreground font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-foreground-muted">
                <li><Link href="/candidate" className="hover:text-cyber-purple transition">Browse Jobs</Link></li>
                <li><Link href="/about" className="hover:text-cyber-purple transition">About TechHire</Link></li>
                <li><a href="/company" className="hover:text-cyber-purple transition">Post a Job</a></li>
                <li><Link href="/privacy" className="hover:text-cyber-purple transition">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-cyber-purple transition">Terms</Link></li>
                <li><Link href="/contact" className="hover:text-cyber-purple transition">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-glass-border pt-8">
            <p className="text-center text-foreground-muted text-sm">
              © 2026 TechHire. All rights reserved. Built for modern hiring teams.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <ErrorBoundary>
      <HomeContent />
    </ErrorBoundary>
  );
}
