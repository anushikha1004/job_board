/**
 * Candidate Dashboard
 * For candidates to browse and save jobs
 */

'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/Layout';
import { UserProfile } from '@/components/UserProfile';
import { Heart, Briefcase, Search } from 'lucide-react';
import { Toast, type ToastMessage } from '@/components/Toast';
import { useFirestoreJobs, usePagination } from '@/lib/hooks';
import { getUserFavorites, addFavorite, removeFavorite } from '@/lib/favorites';
import { JobGrid } from '@/components/JobCard';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getCompanyProfilesByUserIds } from '@/lib/firestore';
import type { CompanyProfile } from '@/types/company';
import Link from 'next/link';
import { isCandidateProfileComplete } from '@/lib/candidate-profile';
import { setRoleCookie } from '@/lib/role-cookie';
import { getCandidateApplications } from '@/lib/applications';
import { sortJobs } from '@/lib/utils';

type SavedSort =
  | 'recent'
  | 'salary_desc'
  | 'salary_asc'
  | 'company_asc'
  | 'title_asc';

export default function CandidateDashboard() {
  const { user, isLoading, isSignedIn } = useAuth();
  const { jobs } = useFirestoreJobs(true);
  const router = useRouter();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [isCandidate, setIsCandidate] = useState(false);
  const [companyProfiles, setCompanyProfiles] = useState<Record<string, CompanyProfile>>({});
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [favoritePendingIds, setFavoritePendingIds] = useState<Record<string, boolean>>({});
  const [toastQueue, setToastQueue] = useState<ToastMessage[]>([]);
  const [savedSort, setSavedSort] = useState<SavedSort>('recent');
  const [showAppliedOnly, setShowAppliedOnly] = useState(false);

  useEffect(() => {
    if (!isLoading && !isSignedIn) {
      router.push('/login/candidate');
    }
  }, [isLoading, isSignedIn, router]);

  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    setToastQueue((prev) => [...prev, { ...toast, id: Date.now() + Math.floor(Math.random() * 1000) }]);
  }, []);

  const dismissToast = useCallback(() => {
    setToastQueue((prev) => prev.slice(1));
  }, []);

  const activeToast = toastQueue[0] || null;

  const loadFavorites = useCallback(async () => {
    if (!user) return;
    setIsLoadingFavorites(true);
    try {
      const faves = await getUserFavorites(user.uid);
      setFavorites(faves);
    } catch (err) {
      console.error('Error loading favorites:', err);
    } finally {
      setIsLoadingFavorites(false);
    }
  }, [user]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isSignedIn || !user) {
      setIsRoleLoading(false);
      setIsCandidate(false);
      return;
    }

    const checkRole = async () => {
      try {
        const userProfileRef = doc(db, 'user_profiles', user.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        const role = userProfileSnap.data()?.role;

        // Redirect only when we explicitly know this is a company account.
        if (role === 'admin') {
          setRoleCookie('admin');
          setIsCandidate(false);
          router.replace('/admin');
          return;
        }
        if (role === 'company') {
          setRoleCookie('company');
          setIsCandidate(false);
          router.replace('/company');
        } else {
          setRoleCookie('candidate');
          if (!isCandidateProfileComplete(userProfileSnap.data() as Record<string, unknown> | undefined)) {
            setIsCandidate(false);
            router.replace('/candidate/profile?onboarding=1');
            return;
          }
          // candidate or missing/unknown role => allow this page to avoid redirect loops
          setIsCandidate(true);
        }
      } catch (err) {
        console.error('Error checking user role:', err);
        // On transient Firestore errors, keep user on current page instead of bouncing routes.
        setIsCandidate(true);
      } finally {
        setIsRoleLoading(false);
      }
    };

    checkRole();
  }, [isLoading, isSignedIn, user, router]);

  useEffect(() => {
    if (user && isCandidate) {
      loadFavorites();
    }
  }, [user, isCandidate, loadFavorites]);

  useEffect(() => {
    const loadAppliedJobs = async () => {
      if (!user || !isCandidate) {
        setAppliedJobIds(new Set());
        return;
      }
      try {
        const applications = await getCandidateApplications(user.uid);
        setAppliedJobIds(new Set(applications.map((item) => item.job_id)));
      } catch (error) {
        console.error('Candidate applied jobs load error:', error);
        setAppliedJobIds(new Set());
      }
    };
    loadAppliedJobs();
  }, [user, isCandidate]);

  useEffect(() => {
    const loadCompanyProfiles = async () => {
      const userIds = jobs.map((job) => job.postedBy).filter((id): id is string => Boolean(id));
      const profiles = await getCompanyProfilesByUserIds(userIds);
      setCompanyProfiles(profiles);
    };
    loadCompanyProfiles();
  }, [jobs]);

  const jobsWithProfiles = useMemo(
    () =>
      jobs.map((job) => ({
        ...job,
        companyProfile: job.postedBy ? companyProfiles[job.postedBy] : undefined,
      })),
    [jobs, companyProfiles]
  );

  const runFavoriteMutation = useCallback(async (jobId: string, shouldFavorite: boolean) => {
    if (!user) return;

    setFavoritePendingIds((prev) => ({ ...prev, [jobId]: true }));
    setFavorites((prev) =>
      shouldFavorite ? Array.from(new Set([...prev, jobId])) : prev.filter((id) => id !== jobId)
    );

    try {
      if (shouldFavorite) {
        await addFavorite(user.uid, jobId);
        pushToast({ type: 'success', message: 'Added to saved jobs.' });
      } else {
        await removeFavorite(user.uid, jobId);
        pushToast({ type: 'success', message: 'Removed from saved jobs.' });
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      // rollback optimistic update
      setFavorites((prev) =>
        shouldFavorite ? prev.filter((id) => id !== jobId) : [...prev, jobId]
      );
      pushToast({
        type: 'error',
        message: 'Failed to update saved jobs.',
        action: {
          label: 'Retry',
          onClick: () => {
            dismissToast();
            runFavoriteMutation(jobId, shouldFavorite);
          },
        },
      });
    } finally {
      setFavoritePendingIds((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    }
  }, [dismissToast, pushToast, user]);

  const handleToggleFavorite = useCallback((jobId: string) => {
    const isCurrentlyFavorited = favorites.includes(jobId);
    runFavoriteMutation(jobId, !isCurrentlyFavorited);
  }, [favorites, runFavoriteMutation]);

  useEffect(() => {
    if (!activeToast || activeToast.type === 'error') return;
    const timeout = setTimeout(() => dismissToast(), 2400);
    return () => clearTimeout(timeout);
  }, [activeToast, dismissToast]);

  const savedJobs = useMemo(() => {
    const rows = jobsWithProfiles.filter((job) => favorites.includes(job.id));
    if (savedSort === 'recent') return sortJobs(rows, 'newest');
    if (savedSort === 'salary_desc') return sortJobs(rows, 'salary_desc');
    if (savedSort === 'salary_asc') {
      return [...rows].sort((a, b) => (a.salary_range?.min || 0) - (b.salary_range?.min || 0));
    }
    if (savedSort === 'company_asc') {
      return [...rows].sort((a, b) => a.company_name.localeCompare(b.company_name));
    }
    return [...rows].sort((a, b) => a.title.localeCompare(b.title));
  }, [jobsWithProfiles, favorites, savedSort]);

  const allJobs = useMemo(
    () => (showAppliedOnly ? jobsWithProfiles.filter((job) => appliedJobIds.has(job.id)) : jobsWithProfiles),
    [jobsWithProfiles, showAppliedOnly, appliedJobIds]
  );

  const {
    currentPage: savedPage,
    totalPages: savedTotalPages,
    currentItems: paginatedSavedJobs,
    nextPage: nextSavedPage,
    prevPage: prevSavedPage,
  } = usePagination(savedJobs, 6);

  const {
    currentPage: allPage,
    totalPages: allTotalPages,
    currentItems: paginatedAllJobs,
    nextPage: nextAllPage,
    prevPage: prevAllPage,
  } = usePagination(allJobs, 9);

  if (isLoading || isRoleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground">Loading...</div>
      </div>
    );
  }

  if (!user || !isCandidate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground-muted">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto w-full px-6 py-10 xl:px-12">
        <div className="mb-5">
          <Toast toast={activeToast} onClose={dismissToast} />
        </div>

        {/* User Info */}
        <section className="glass rounded-xl p-7 mb-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Welcome, {user.email?.split('@')[0]}!</h1>
              <p className="text-foreground-muted">Browse and save your favorite jobs</p>
              <Link href="/candidate/profile" className="inline-flex mt-4 btn-secondary py-2 px-4 text-sm">
                Full Profile
              </Link>
            </div>
            <UserProfile />
          </div>
        </section>

        {/* Saved Jobs */}
        <section className="mb-10">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-cyber-purple" />
            <h2 className="text-2xl font-bold text-foreground">Saved Jobs ({favorites.length})</h2>
            </div>
            <div className="inline-flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground-light">Sort</label>
              <select
                value={savedSort}
                onChange={(e) => setSavedSort(e.target.value as SavedSort)}
                className="auth-input px-3 py-2 text-sm text-foreground"
              >
                <option value="recent">Newest</option>
                <option value="salary_desc">Salary: High to Low</option>
                <option value="salary_asc">Salary: Low to High</option>
                <option value="company_asc">Company (A-Z)</option>
                <option value="title_asc">Job Title (A-Z)</option>
              </select>
            </div>
          </div>

          {isLoadingFavorites ? (
            <div className="text-foreground-muted">Loading saved jobs...</div>
          ) : favorites.length > 0 ? (
            <JobGrid 
              jobs={paginatedSavedJobs.map((job) => ({
                  ...job,
                  alreadyApplied: appliedJobIds.has(job.id),
                  onFavoriteToggle: () => handleToggleFavorite(job.id),
                  isFavorited: favorites.includes(job.id),
                  isFavoriteLoading: Boolean(favoritePendingIds[job.id]),
                }))}
            />
          ) : (
            <div className="glass rounded-xl p-10 text-center">
              <Heart className="w-12 h-12 text-foreground-muted/30 mx-auto mb-4" />
              <p className="text-foreground-muted">No saved jobs yet. Browse jobs below!</p>
            </div>
          )}

          {savedTotalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-2">
              <button className="btn-secondary py-2 px-3 text-sm" onClick={prevSavedPage} disabled={savedPage === 1}>
                Prev
              </button>
              <span className="text-sm text-foreground-muted">Page {savedPage} of {savedTotalPages}</span>
              <button className="btn-secondary py-2 px-3 text-sm" onClick={nextSavedPage} disabled={savedPage === savedTotalPages}>
                Next
              </button>
            </div>
          )}
        </section>

        {/* All Jobs */}
        <section>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Search className="w-6 h-6 text-electric-blue" />
              <h2 className="text-2xl font-bold text-foreground">Browse All Jobs ({allJobs.length})</h2>
            </div>
            <div className="inline-flex items-center gap-2">
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
          </div>

          {allJobs.length > 0 ? (
            <JobGrid
              jobs={paginatedAllJobs.map((job) => ({
                ...job,
                alreadyApplied: appliedJobIds.has(job.id),
                onFavoriteToggle: () => handleToggleFavorite(job.id),
                isFavorited: favorites.includes(job.id),
                isFavoriteLoading: Boolean(favoritePendingIds[job.id]),
              }))}
            />
          ) : (
            <div className="glass rounded-xl p-10 text-center">
              <Briefcase className="w-12 h-12 text-foreground-muted/30 mx-auto mb-4" />
              <p className="text-foreground-muted">No jobs available yet</p>
            </div>
          )}

          {allTotalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-2">
              <button className="btn-secondary py-2 px-3 text-sm" onClick={prevAllPage} disabled={allPage === 1}>
                Prev
              </button>
              <span className="text-sm text-foreground-muted">Page {allPage} of {allTotalPages}</span>
              <button className="btn-secondary py-2 px-3 text-sm" onClick={nextAllPage} disabled={allPage === allTotalPages}>
                Next
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
