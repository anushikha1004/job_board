'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Briefcase, CalendarClock, CircleCheck, Settings, UserRound } from 'lucide-react';
import { Header } from '@/components/Layout';
import { Toast, type ToastMessage } from '@/components/Toast';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import {
  canReapply,
  getCandidateApplications,
  type JobApplication,
  reapplyToJob,
  withdrawApplication,
} from '@/lib/applications';
import { formatDate } from '@/lib/utils';

function statusClass(status: JobApplication['status']): string {
  if (status === 'hired') return 'border-neon-green/40 bg-neon-green/10 text-neon-green';
  if (status === 'rejected') return 'border-red-500/40 bg-red-500/10 text-red-300';
  if (status === 'shortlisted') return 'border-electric-blue/40 bg-electric-blue/10 text-electric-blue';
  if (status === 'interviewing') return 'border-violet-500/40 bg-violet-500/10 text-violet-400';
  if (status === 'withdrawn') return 'border-slate-400/40 bg-slate-500/10 text-slate-300';
  if (status === 'reviewed') return 'border-amber-500/40 bg-amber-500/10 text-amber-700';
  return 'border-glass-border bg-background-secondary/70 text-foreground';
}

export default function CandidateApplicationsPage() {
  const { user, isLoading, isSignedIn } = useAuth();
  const router = useRouter();
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [reapplyingId, setReapplyingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (!isLoading && !isSignedIn) {
      router.replace('/login/candidate');
    }
  }, [isLoading, isSignedIn, router]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      try {
        const profileSnap = await getDoc(doc(db, 'user_profiles', user.uid));
        const role = profileSnap.data()?.role;
        if (role === 'admin') {
          router.replace('/admin');
          return;
        }
        if (role === 'company') {
          router.replace('/company/applications');
          return;
        }

        const apps = await getCandidateApplications(user.uid);
        setApplications(apps);
      } catch (err) {
        console.error('Candidate applications load error:', err);
        setToast({ id: Date.now(), type: 'error', message: 'Failed to load applications.' });
      } finally {
        setIsRoleLoading(false);
      }
    };

    if (!isLoading && isSignedIn && user) {
      loadData();
    } else if (!isLoading) {
      setIsRoleLoading(false);
    }
  }, [isLoading, isSignedIn, user, router]);

  const submittedCount = useMemo(
    () => applications.filter((item) => item.status === 'submitted').length,
    [applications]
  );
  const interviewingCount = useMemo(
    () => applications.filter((item) => item.status === 'interviewing').length,
    [applications]
  );

  const hasActiveApplicationByJobId = useMemo(() => {
    const result = new Set<string>();
    applications.forEach((item) => {
      if (!canReapply(item)) result.add(item.job_id);
    });
    return result;
  }, [applications]);

  const handleWithdraw = async (applicationId: string) => {
    if (!user) return;
    const previous = applications;
    setWithdrawingId(applicationId);
    setApplications((prev) =>
      prev.map((item) =>
        item.id === applicationId
          ? { ...item, status: 'withdrawn', withdrawn_by_candidate: true }
          : item
      )
    );
    try {
      await withdrawApplication(applicationId, user.uid);
      setToast({ id: Date.now(), type: 'success', message: 'Application withdrawn.' });
    } catch (error) {
      setApplications(previous);
      console.error('Withdraw application failed:', error);
      setToast({ id: Date.now(), type: 'error', message: 'Could not withdraw application.' });
    } finally {
      setWithdrawingId(null);
    }
  };

  const handleReapply = async (application: JobApplication) => {
    if (!canReapply(application)) return;
    if (hasActiveApplicationByJobId.has(application.job_id)) {
      setToast({
        id: Date.now(),
        type: 'error',
        message: 'You already have an active application for this job.',
      });
      return;
    }

    setReapplyingId(application.id);
    try {
      await reapplyToJob(application);
      const apps = await getCandidateApplications(application.candidate_id);
      setApplications(apps);
      setToast({
        id: Date.now(),
        type: 'success',
        message: 'Application re-submitted successfully.',
      });
    } catch (error) {
      console.error('Re-apply failed:', error);
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : '';
      setToast({
        id: Date.now(),
        type: 'error',
        message: message === 'ALREADY_APPLIED'
          ? 'You already have an active application for this job.'
          : 'Could not re-apply for this role.',
      });
    } finally {
      setReapplyingId(null);
    }
  };

  if (isLoading || isRoleLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-foreground">Loading...</div></div>;
  }

  if (!user) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-foreground-muted">Redirecting...</div></div>;
  }

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
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyber-purple to-electric-blue text-xl font-extrabold tracking-wide text-white">
                  {(user.email?.[0] || 'C').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-foreground break-words">{user.email?.split('@')[0]}</h2>
                  <p className="mt-1 text-sm text-foreground-muted">Applications: {applications.length}</p>
                </div>
              </div>
              <nav className="mt-5 space-y-2 border-t border-glass-border pt-4">
                <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <Briefcase className="h-4 w-4" />
                  Discover Jobs
                </Link>
                <div className="flex items-center gap-3 rounded-xl bg-background-secondary/80 px-3 py-2 text-sm font-bold text-foreground">
                  <CircleCheck className="h-4 w-4" />
                  Applications
                </div>
                <Link href="/candidate/notifications" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <CalendarClock className="h-4 w-4" />
                  Notifications
                </Link>
                <Link href="/candidate/profile" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <UserRound className="h-4 w-4" />
                  My Profile
                </Link>
                <Link href="/candidate/settings" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <Settings className="h-4 w-4" />
                  Account Settings
                </Link>
              </nav>
            </section>
          </aside>

          <div className="space-y-6">
            <section className="glass rounded-2xl p-7 md:p-8">
              <h1 className="text-3xl font-bold text-foreground">Your Applications</h1>
              <p className="mt-2 text-foreground-muted">Track all jobs you have applied to.</p>
              <p className="mt-3 text-sm text-foreground-light">Pending review: {submittedCount} • Interviewing: {interviewingCount}</p>
            </section>

            <section className="space-y-4">
              {applications.length === 0 ? (
                <div className="glass rounded-2xl p-10 text-center">
                  <p className="text-foreground-muted">No applications yet. Start applying to roles.</p>
                  <Link href="/" className="btn-primary mt-4 inline-flex px-5 py-2">Browse Jobs</Link>
                </div>
              ) : (
                applications.map((application) => (
                  <article key={application.id} className="glass rounded-2xl p-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-foreground">{application.job_title}</h2>
                        <p className="text-sm text-foreground-muted mt-1">{application.company_name} • {application.location || 'Remote'} • {application.type || 'Full-time'}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusClass(application.status)}`}>
                        {application.status}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-foreground-light">
                      <span>Applied: {formatDate(application.created_at)}</span>
                      {application.interview_at && (
                        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-400">
                          Interview: {formatDate(application.interview_at)}
                        </span>
                      )}
                      {application.recruiter_notes && (
                        <span className="rounded-full border border-glass-border px-2 py-0.5 text-xs">
                          Note: {application.recruiter_notes}
                        </span>
                      )}
                      {application.apply_url && (
                        <a href={application.apply_url} target="_blank" rel="noopener noreferrer" className="btn-secondary py-1.5 px-3 text-xs">
                          Open Job Link
                        </a>
                      )}
                      {!['withdrawn', 'rejected', 'hired'].includes(application.status) && (
                        <button
                          type="button"
                          onClick={() => handleWithdraw(application.id)}
                          disabled={withdrawingId === application.id}
                          className="btn-secondary py-1.5 px-3 text-xs text-red-300 disabled:opacity-60"
                        >
                          Withdraw
                        </button>
                      )}
                      {canReapply(application) && !hasActiveApplicationByJobId.has(application.job_id) && (
                        <button
                          type="button"
                          onClick={() => handleReapply(application)}
                          disabled={reapplyingId === application.id}
                          className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-60"
                        >
                          {reapplyingId === application.id ? 'Re-applying...' : 'Re-apply'}
                        </button>
                      )}
                    </div>
                  </article>
                ))
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
