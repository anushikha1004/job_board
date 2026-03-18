/**
 * Company Dashboard
 * For recruiters to post and manage job listings
 */

'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Header } from '@/components/Layout';
import { UserProfile } from '@/components/UserProfile';
import Link from 'next/link';
import { Bell, Briefcase, Building2, ClipboardList, Pencil, Plus, Settings, Trash2, UserRound } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Toast, type ToastMessage } from '@/components/Toast';
import { getUserPostedJobs } from '@/lib/favorites';
import { postJob } from '@/lib/favorites';
import { JobPostingForm } from '@/components/JobPostingForm';
import { deleteJobById, getCompanyProfileByUserId, updateJob, upsertCompanyProfile } from '@/lib/firestore';
import type { Job } from '@/types/job';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { setRoleCookie } from '@/lib/role-cookie';
import { PIPELINE_LABELS, PIPELINE_STATES, isJobOpen, type PipelineState } from '@/lib/job-workflow';
import { retry } from '@/lib/retry';

function normalizeCompanyDisplayName(raw: string, fallbackEmail?: string | null): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallbackEmail?.split('@')[0] || 'Recruiter Profile';

  const withoutLeadingNoise = cleaned.replace(/^[^A-Za-z]+/, '').trim();
  if (!withoutLeadingNoise) return fallbackEmail?.split('@')[0] || 'Recruiter Profile';

  return withoutLeadingNoise;
}

function initialsFromCompany(name: string): string {
  const words = name
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);
  if (words.length === 0) return 'R';
  const initials = words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return initials || 'R';
}

export default function CompanyDashboard() {
  const { user, isLoading, isSignedIn } = useAuth();
  const router = useRouter();
  const [postedJobs, setPostedJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [isCompany, setIsCompany] = useState(false);
  const [profileForm, setProfileForm] = useState({
    company_name: '',
    website: '',
    about: '',
    size: '',
    location: '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [deleteTargetJob, setDeleteTargetJob] = useState<{ id: string; title: string } | null>(null);
  const [initialProfileSnapshot, setInitialProfileSnapshot] = useState({
    company_name: '',
    website: '',
    about: '',
    size: '',
    location: '',
  });

  useEffect(() => {
    if (!isLoading && !isSignedIn) {
      router.replace('/login/recruiter');
    }
  }, [isLoading, isSignedIn, router]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isSignedIn || !user) {
      setIsRoleLoading(false);
      setIsCompany(false);
      return;
    }

    const checkRole = async () => {
      try {
        const userProfileRef = doc(db, 'user_profiles', user.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        const role = userProfileSnap.data()?.role;

        // Redirect only when we explicitly know this is a candidate account.
        if (role === 'admin') {
          setRoleCookie('admin');
          setIsCompany(false);
          router.replace('/admin');
          return;
        }
        if (role === 'candidate') {
          setRoleCookie('candidate');
          setIsCompany(false);
          router.replace('/candidate');
        } else {
          setRoleCookie('company');
          // company or missing/unknown role => allow this page to avoid redirect loops
          setIsCompany(true);
        }
      } catch (err) {
        logError('company.role.check.error', err, { uid: user.uid });
        // On transient Firestore errors, keep user on current page instead of bouncing routes.
        setIsCompany(true);
      } finally {
        setIsRoleLoading(false);
      }
    };

    checkRole();
  }, [isLoading, isSignedIn, user, router]);

  const loadPostedJobs = useCallback(async () => {
    if (!user) return;
    setIsLoadingJobs(true);
    try {
      const jobs = await retry(() => getUserPostedJobs(user.uid), {
        retries: 2,
        baseDelayMs: 200,
      });
      setPostedJobs(jobs);
    } catch (err) {
      logError('company.jobs.load.error', err, { uid: user.uid });
    } finally {
      setIsLoadingJobs(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && isCompany) {
      loadPostedJobs();
    }
  }, [user, isCompany, loadPostedJobs]);

  useEffect(() => {
    const loadCompanyProfile = async () => {
      if (!user || !isCompany) return;
      try {
        const profile = await retry(() => getCompanyProfileByUserId(user.uid), {
          retries: 2,
          baseDelayMs: 200,
        });
        if (!profile) {
          const emptyProfile = {
            company_name: user.email?.split('@')[0] || '',
            website: '',
            about: '',
            size: '',
            location: '',
          };
          setProfileForm(emptyProfile);
          setInitialProfileSnapshot(emptyProfile);
          return;
        }
        const loadedProfile = {
          company_name: profile.company_name || '',
          website: profile.website || '',
          about: profile.about || '',
          size: profile.size || '',
          location: profile.location || '',
        };
        setProfileForm(loadedProfile);
        setInitialProfileSnapshot(loadedProfile);
      } catch (err) {
        logError('company.profile.load.error', err, { uid: user.uid });
        setProfileStatus({ type: 'error', message: 'Could not load company profile. You can still edit and save.' });
      }
    };

    loadCompanyProfile();
  }, [user, isCompany]);

  const handleProfileChange = (field: keyof typeof profileForm, value: string) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
    if (profileStatus?.type === 'success') {
      setProfileStatus(null);
    }
  };

  const isProfileDirty = JSON.stringify(profileForm) !== JSON.stringify(initialProfileSnapshot);
  const isCompanyNameValid = profileForm.company_name.trim().length >= 2;

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!isCompanyNameValid) {
      setProfileStatus({ type: 'error', message: 'Company name must be at least 2 characters.' });
      return;
    }

    try {
      setIsSavingProfile(true);
      setProfileStatus({ type: 'info', message: 'Saving company profile...' });
      await upsertCompanyProfile(user.uid, {
        company_name: profileForm.company_name.trim(),
        website: profileForm.website.trim(),
        about: profileForm.about.trim(),
        size: profileForm.size.trim(),
        location: profileForm.location.trim(),
      });
      setInitialProfileSnapshot(profileForm);
      setProfileStatus({ type: 'success', message: 'Company profile saved successfully.' });
      logInfo('company.profile.save.success', { uid: user.uid });
    } catch (err) {
      logError('company.profile.save.error', err, { uid: user.uid });
      setProfileStatus({ type: 'error', message: 'Failed to save company profile. Please try again.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {

    // Optimistic UI: remove immediately, restore on failure
    const previous = postedJobs;
    setPostedJobs((prev) => prev.filter((job) => job.id !== jobId));

    try {
      await deleteJobById(jobId);
      setToast({
        id: Date.now(),
        type: 'success',
        message: 'Job deleted successfully.',
      });
    } catch (err) {
      logError('company.job.delete.error', err, { jobId, uid: user?.uid });
      // restore previous state
      setPostedJobs(previous);
      setToast({
        id: Date.now(),
        type: 'error',
        message: `Failed to delete job: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleToggleArchive = async (job: Job) => {
    const nextStatus = isJobOpen(job) ? 'archived' : 'open';
    const previous = postedJobs;
    setPostedJobs((prev) => prev.map((item) => (item.id === job.id ? { ...item, status: nextStatus } : item)));

    try {
      await updateJob(job.id, { status: nextStatus });
      setToast({
        id: Date.now(),
        type: 'success',
        message: nextStatus === 'archived' ? 'Job archived.' : 'Job reopened.',
      });
    } catch (err) {
      logError('company.job.archive.error', err, { jobId: job.id, uid: user?.uid, status: nextStatus });
      setPostedJobs(previous);
      setToast({
        id: Date.now(),
        type: 'error',
        message: 'Failed to update job status.',
      });
    }
  };

  const handlePipelineStateChange = async (job: Job, nextPipeline: PipelineState) => {
    const previous = postedJobs;
    setPostedJobs((prev) =>
      prev.map((item) => (item.id === job.id ? { ...item, pipeline_state: nextPipeline } : item))
    );

    try {
      await updateJob(job.id, { pipeline_state: nextPipeline });
      setToast({
        id: Date.now(),
        type: 'success',
        message: `Pipeline moved to ${PIPELINE_LABELS[nextPipeline]}.`,
      });
    } catch (err) {
      logError('company.job.pipeline.error', err, { jobId: job.id, uid: user?.uid, nextPipeline });
      setPostedJobs(previous);
      setToast({
        id: Date.now(),
        type: 'error',
        message: 'Failed to update pipeline state.',
      });
    }
  };

  const handleDuplicateJob = async (job: Job) => {
    if (!user) return;
    try {
      const duplicated = await postJob(user.uid, {
        title: `${job.title} (Copy)`,
        company_name: job.company_name,
        tags: job.tags || [],
        salary_range: {
          min: job.salary_range?.min || 0,
          max: job.salary_range?.max || 0,
          currency: job.salary_range?.currency || 'USD',
        },
        apply_url: job.apply_url,
        location: job.location,
        type: job.type,
        description: job.description || '',
        status: 'archived',
        pipeline_state: 'new',
        postedBy: user.uid,
      });

      setPostedJobs((prev) => [duplicated, ...prev]);
      setToast({
        id: Date.now(),
        type: 'success',
        message: 'Job duplicated as draft.',
      });
    } catch (err) {
      logError('company.job.duplicate.error', err, { jobId: job.id, uid: user.uid });
      setToast({
        id: Date.now(),
        type: 'error',
        message: 'Failed to duplicate job.',
      });
    }
  };

  useEffect(() => {
    if (!toast || toast.type === 'error') return;
    const timeout = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timeout);
  }, [toast]);

  if (isLoading || isRoleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground">Loading...</div>
      </div>
    );
  }

  if (!user || !isCompany) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground-muted">Redirecting...</div>
      </div>
    );
  }

  // Completion is based on core profile fields shown publicly.
  // Website remains optional and does not reduce completion.
  const companyCompletionChecks = [
    profileForm.company_name.trim().length >= 2,
    profileForm.about.trim().length >= 20,
    profileForm.size.trim().length > 0,
    profileForm.location.trim().length > 0,
  ];
  const companyCompletion = Math.round(
    (companyCompletionChecks.filter(Boolean).length / companyCompletionChecks.length) * 100
  );
  const companyDisplayName = normalizeCompanyDisplayName(profileForm.company_name, user.email);
  const companyInitials = initialsFromCompany(companyDisplayName);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto w-full px-6 py-10 xl:px-12">
        <div className="mb-5">
          <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[290px_1fr]">
          <aside className="lg:sticky lg:top-24 h-fit">
            <section className="glass rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-cyber-purple to-electric-blue text-xl font-extrabold tracking-wide text-white shadow-md">
                  {companyInitials}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-foreground leading-tight wrap-break-word">{companyDisplayName}</h2>
                  <p className="mt-1 text-sm text-foreground-muted">{profileForm.location.trim() || 'Location not set'}</p>
                  <p className="mt-1 truncate text-sm text-foreground-light" title={user.email || ''}>
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs text-foreground-muted">
                  <span>Profile completion</span>
                  <span>{companyCompletion}%</span>
                </div>
                <div className="h-2 rounded-full bg-background-secondary/80">
                  <div
                    className="h-2 rounded-full bg-linear-to-r from-cyber-purple to-electric-blue transition-all duration-300"
                    style={{ width: `${companyCompletion}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 border-t border-glass-border pt-4">
                <button
                  onClick={() => setShowPostForm(true)}
                  className="btn-primary w-full py-2.5 px-4 text-sm inline-flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Post New Job
                </button>
              </div>

              <nav className="mt-5 space-y-2 border-t border-glass-border pt-4">
                <a href="#company-overview" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <Building2 className="h-4 w-4" />
                  Overview
                </a>
                <a href="#company-profile" className="flex items-center gap-3 rounded-xl bg-background-secondary/80 px-3 py-2 text-sm font-bold text-foreground">
                  <UserRound className="h-4 w-4" />
                  Company Profile
                </a>
                <a href="#company-jobs" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <ClipboardList className="h-4 w-4" />
                  Job Postings
                </a>
                <Link href="/company/applications" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <UserRound className="h-4 w-4" />
                  Applications
                </Link>
                <Link href="/company/notifications" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <Bell className="h-4 w-4" />
                  Notifications
                </Link>
                <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <Briefcase className="h-4 w-4" />
                  Browse Jobs
                </Link>
                <Link href="/company/settings" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <Settings className="h-4 w-4" />
                  Account Settings
                </Link>
              </nav>
            </section>
          </aside>

          <div>
        {/* User Info */}
        <section id="company-overview" className="glass mb-8 rounded-2xl p-7 md:p-8 scroll-mt-28">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Company Dashboard</h1>
              <p className="text-foreground-muted">Manage your job postings</p>
            </div>
            <UserProfile />
          </div>
        </section>

        {/* Company Profile */}
        <section id="company-profile" className="glass mb-8 rounded-2xl p-7 md:p-8 scroll-mt-28">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Company Profile</h2>
              <p className="text-sm text-foreground-muted mt-1">Update your public company details shown to candidates.</p>
            </div>
          </div>
          {profileStatus && (
            <div
              className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                profileStatus.type === 'success'
                  ? 'border-neon-green/40 bg-neon-green/10 text-neon-green'
                  : profileStatus.type === 'error'
                    ? 'border-red-500/40 bg-red-500/10 text-red-300'
                    : 'border-electric-blue/40 bg-electric-blue/10 text-electric-blue'
              }`}
            >
              {profileStatus.message}
            </div>
          )}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-foreground-light">Company Name *</label>
              <input
                value={profileForm.company_name}
                onChange={(e) => handleProfileChange('company_name', e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-3"
                placeholder="TechHire Inc."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-foreground-light">Website</label>
              <input
                value={profileForm.website}
                onChange={(e) => handleProfileChange('website', e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-3"
                placeholder="https://company.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-foreground-light">Company Size</label>
              <input
                value={profileForm.size}
                onChange={(e) => handleProfileChange('size', e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-3"
                placeholder="51-200 employees"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-foreground-light">Location</label>
              <input
                value={profileForm.location}
                onChange={(e) => handleProfileChange('location', e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-3"
                placeholder="San Francisco, CA"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm text-foreground-light">About</label>
              <textarea
                value={profileForm.about}
                onChange={(e) => handleProfileChange('about', e.target.value)}
                className="glass-input min-h-36 w-full rounded-xl px-4 py-3"
                placeholder="Tell candidates about your company, mission, and hiring culture."
              />
            </div>
          </div>
          <div className="mt-5">
            <button
              className={`${isProfileDirty ? 'btn-primary' : 'btn-secondary'} disabled:opacity-70`}
              onClick={handleSaveProfile}
              disabled={isSavingProfile || !isProfileDirty || !isCompanyNameValid}
            >
              {isSavingProfile ? 'Saving...' : isProfileDirty ? 'Save Company Profile' : 'All Changes Saved'}
            </button>
          </div>
        </section>

        {/* Post Job Button */}
        <section className="mb-8">
          <button
            onClick={() => {
              if (!user) {
                router.replace('/login/recruiter');
                return;
              }
              setShowPostForm(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Post New Job
          </button>
        </section>

        {/* Posted Jobs */}
        <section id="company-jobs" className="scroll-mt-28">
          <div className="flex items-center gap-3 mb-5">
            <Briefcase className="w-6 h-6 text-cyber-purple" />
            <h2 className="text-2xl font-bold text-foreground">Your Job Postings ({postedJobs.length})</h2>
          </div>

          {isLoadingJobs ? (
            <div className="text-foreground-muted">Loading your jobs...</div>
          ) : postedJobs.length > 0 ? (
            <div className="grid grid-cols-1 gap-5">
              {postedJobs.map((job) => (
                <div key={job.id} className="glass rounded-2xl p-6 transition hover:shadow-xl">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <a href={`/jobs/${job.id}`} className="block no-underline">
                        <h3 className="text-xl font-bold text-foreground">{job.title}</h3>
                      </a>
                      <p className="text-foreground-light">{job.company_name}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            isJobOpen(job)
                              ? 'border-neon-green/40 bg-neon-green/10 text-neon-green'
                              : 'border-amber-500/40 bg-amber-500/10 text-amber-700'
                          }`}
                        >
                          {isJobOpen(job)
                            ? 'Open'
                            : (job.pipeline_state || 'new') === 'new'
                              ? 'Draft'
                              : 'Archived'}
                        </span>
                        <span className="rounded-full border border-electric-blue/35 bg-electric-blue/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-electric-blue">
                          {PIPELINE_LABELS[(job.pipeline_state as PipelineState) || 'new']}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingJob(job)}
                        className="btn-secondary py-1.5 px-2.5 text-xs inline-flex items-center gap-1"
                        aria-label={`Edit ${job.title}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleArchive(job)}
                        className="btn-secondary py-1.5 px-2.5 text-xs"
                      >
                        {isJobOpen(job)
                          ? 'Archive'
                          : (job.pipeline_state || 'new') === 'new'
                            ? 'Publish'
                            : 'Reopen'}
                      </button>
                      <button
                        onClick={() => handleDuplicateJob(job)}
                        className="btn-secondary py-1.5 px-2.5 text-xs"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => setDeleteTargetJob({ id: job.id, title: job.title })}
                        className="text-red-400 hover:text-red-300 transition"
                        aria-label={`Delete ${job.title}`}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-foreground-muted text-sm leading-relaxed mb-4">{job.description}</p>

                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    {job.tags?.map((tag: string) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mb-4 max-w-xs">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                      Applicant Pipeline
                    </label>
                    <select
                      value={(job.pipeline_state as PipelineState) || 'new'}
                      onChange={(e) => handlePipelineStateChange(job, e.target.value as PipelineState)}
                      className="glass-input w-full rounded-lg px-3 py-2 text-sm"
                    >
                      {PIPELINE_STATES.map((state) => (
                        <option key={state} value={state}>
                          {PIPELINE_LABELS[state]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-foreground-light">
                    {job.location && <span>📍 {job.location}</span>}
                    {job.type && <span>💼 {job.type}</span>}
                    {job.salary_range?.min && (
                      (() => {
                        const currency = job.salary_range?.currency || 'USD';
                        const symbol = currency === 'GBP' ? '£' : '$';
                        const locale = currency === 'GBP' ? 'en-GB' : 'en-US';
                        return (
                          <span>
                            💰 {symbol}{job.salary_range.min.toLocaleString(locale)} - {symbol}{job.salary_range.max.toLocaleString(locale)}
                          </span>
                        );
                      })()
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass rounded-xl p-10 text-center">
              <Briefcase className="w-12 h-12 text-foreground-muted/30 mx-auto mb-4" />
              <p className="text-foreground-muted mb-6">No jobs posted yet</p>
              <button
                onClick={() => setShowPostForm(true)}
                className="btn-primary"
              >
                Post Your First Job
              </button>
            </div>
          )}
        </section>
          </div>
        </div>
      </main>

      {/* Job Posting Form Modal */}
      {showPostForm && (
        <JobPostingForm
          onClose={() => setShowPostForm(false)}
          onSuccess={(job) => {
            if (job) {
              setPostedJobs((prev) => [job, ...prev]);
            } else {
              loadPostedJobs();
            }
          }}
        />
      )}

      {editingJob && (
        <JobPostingForm
          initialJob={editingJob}
          onClose={() => setEditingJob(null)}
          onSuccess={(updatedJob) => {
            if (updatedJob) {
              setPostedJobs((prev) => prev.map((job) => (job.id === updatedJob.id ? { ...job, ...updatedJob } : job)));
              setToast({
                id: Date.now(),
                type: 'success',
                message: 'Job updated successfully.',
              });
            } else {
              loadPostedJobs();
            }
          }}
        />
      )}
      <ConfirmModal
        open={Boolean(deleteTargetJob)}
        title="Delete Job Posting"
        description={
          deleteTargetJob
            ? `Delete "${deleteTargetJob.title}" permanently? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        onCancel={() => setDeleteTargetJob(null)}
        onConfirm={() => {
          if (!deleteTargetJob) return;
          const { id } = deleteTargetJob;
          setDeleteTargetJob(null);
          handleDeleteJob(id);
        }}
      />
    </div>
  );
}
