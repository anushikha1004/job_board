'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Bell, Briefcase, CalendarClock, ClipboardList, Save, Settings } from 'lucide-react';
import { Header } from '@/components/Layout';
import { Toast, type ToastMessage } from '@/components/Toast';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import {
  getCompanyApplications,
  type ApplicationStatus,
  type JobApplication,
  updateApplicationRecruiterFields,
  updateApplicationStatus,
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

const STATUS_OPTIONS: ApplicationStatus[] = ['submitted', 'reviewed', 'shortlisted', 'interviewing', 'rejected', 'hired'];
const BOARD_COLUMNS: ApplicationStatus[] = ['submitted', 'reviewed', 'shortlisted', 'interviewing', 'hired', 'rejected', 'withdrawn'];

export default function CompanyApplicationsPage() {
  const { user, isLoading, isSignedIn } = useAuth();
  const router = useRouter();
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [savingFieldsId, setSavingFieldsId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [interviewDraft, setInterviewDraft] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('all');
  const [skillKeyword, setSkillKeyword] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (!isLoading && !isSignedIn) {
      router.replace('/login/recruiter');
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
        if (role === 'candidate') {
          router.replace('/candidate/applications');
          return;
        }

        const apps = await getCompanyApplications(user.uid);
        setApplications(apps);
        setNotesDraft(
          Object.fromEntries(apps.map((item) => [item.id, item.recruiter_notes || '']))
        );
        setInterviewDraft(
          Object.fromEntries(
            apps.map((item) => [item.id, item.interview_at ? item.interview_at.slice(0, 16) : ''])
          )
        );
      } catch (err) {
        console.error('Company applications load error:', err);
        setToast({ id: Date.now(), type: 'error', message: 'Failed to load applicants.' });
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

  const pendingCount = useMemo(
    () => applications.filter((item) => item.status === 'submitted').length,
    [applications]
  );
  const boardGroups = useMemo(
    () =>
      Object.fromEntries(
        BOARD_COLUMNS.map((status) => [status, applications.filter((item) => item.status === status)])
      ) as Record<ApplicationStatus, JobApplication[]>,
    [applications]
  );
  const filteredApplications = useMemo(() => {
    const keyword = skillKeyword.trim().toLowerCase();
    return applications.filter((item) => {
      const statusMatch = statusFilter === 'all' || item.status === statusFilter;
      const skillMatch =
        keyword.length === 0 ||
        item.job_title.toLowerCase().includes(keyword) ||
        item.recruiter_notes.toLowerCase().includes(keyword);
      return statusMatch && skillMatch;
    });
  }, [applications, statusFilter, skillKeyword]);

  const handleStatusChange = async (applicationId: string, status: ApplicationStatus) => {
    if (!user) return;
    const previous = applications;
    setUpdatingId(applicationId);
    setApplications((prev) => prev.map((item) => (item.id === applicationId ? { ...item, status } : item)));

    try {
      await updateApplicationStatus(applicationId, status, user.uid);
      setToast({ id: Date.now(), type: 'success', message: 'Application status updated.' });
    } catch (err) {
      console.error('Update application status failed:', err);
      setApplications(previous);
      setToast({ id: Date.now(), type: 'error', message: 'Failed to update status.' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveRecruiterFields = async (application: JobApplication) => {
    const notes = (notesDraft[application.id] || '').trim().slice(0, 500);
    const interviewValue = interviewDraft[application.id] || '';
    const interviewDate = interviewValue ? new Date(interviewValue) : null;

    setSavingFieldsId(application.id);
    const previous = applications;
    setApplications((prev) =>
      prev.map((item) =>
        item.id === application.id
          ? {
              ...item,
              recruiter_notes: notes,
              interview_at: interviewDate ? interviewDate.toISOString() : null,
            }
          : item
      )
    );

    try {
      await updateApplicationRecruiterFields(application.id, {
        recruiter_notes: notes,
        interview_at: interviewDate,
      });
      setToast({ id: Date.now(), type: 'success', message: 'Interview details saved.' });
    } catch (error) {
      setApplications(previous);
      console.error('Save recruiter fields failed:', error);
      setToast({ id: Date.now(), type: 'error', message: 'Could not save recruiter notes/interview.' });
    } finally {
      setSavingFieldsId(null);
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
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-cyber-purple to-electric-blue text-xl font-extrabold tracking-wide text-white">
                  {(user.email?.[0] || 'R').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-foreground wrap-break-word">{user.email?.split('@')[0]}</h2>
                  <p className="mt-1 text-sm text-foreground-muted">Applicants: {applications.length}</p>
                </div>
              </div>
              <nav className="mt-5 space-y-2 border-t border-glass-border pt-4">
                <Link href="/company" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <Briefcase className="h-4 w-4" />
                  Dashboard
                </Link>
                <div className="flex items-center gap-3 rounded-xl bg-background-secondary/80 px-3 py-2 text-sm font-bold text-foreground">
                  <ClipboardList className="h-4 w-4" />
                  Applications
                </div>
                <Link href="/company/notifications" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <Bell className="h-4 w-4" />
                  Notifications
                </Link>
                <Link href="/company/settings" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <Settings className="h-4 w-4" />
                  Account Settings
                </Link>
              </nav>
            </section>
          </aside>

          <div className="space-y-6">
            <section className="glass rounded-2xl p-7 md:p-8">
              <h1 className="text-3xl font-bold text-foreground">Applicants</h1>
              <p className="mt-2 text-foreground-muted">Review incoming candidates for your posted jobs.</p>
              <p className="mt-3 text-sm text-foreground-light">Pending review: {pendingCount}</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | ApplicationStatus)}
                  className="glass-input rounded-xl px-3 py-2 text-sm"
                >
                  <option value="all">All Statuses</option>
                  {BOARD_COLUMNS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={skillKeyword}
                  onChange={(e) => setSkillKeyword(e.target.value)}
                  className="glass-input rounded-xl px-3 py-2 text-sm"
                  placeholder="Filter by skill keyword (from title/notes)"
                />
              </div>
            </section>

            <section className="glass rounded-2xl p-6">
              <div className="mb-4 flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-electric-blue" />
                <h2 className="text-xl font-bold text-foreground">Pipeline Board</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {BOARD_COLUMNS.map((status) => (
                  <div key={status} className="rounded-xl border border-glass-border bg-background-secondary/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground-light">{status}</p>
                    <p className="mt-1 text-xl font-bold text-foreground">{boardGroups[status].length}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              {filteredApplications.length === 0 ? (
                <div className="glass rounded-2xl p-10 text-center">
                  <p className="text-foreground-muted">No applications match current filters.</p>
                </div>
              ) : (
                filteredApplications.map((application) => (
                  <article key={application.id} className="glass rounded-2xl p-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-foreground">{application.job_title}</h2>
                        <p className="mt-1 text-sm text-foreground-muted">{application.company_name}</p>
                        <p className="mt-3 text-sm text-foreground">
                          <span className="font-semibold">Candidate:</span> {application.candidate_name}
                        </p>
                        <p className="text-sm text-foreground-light">{application.candidate_email}</p>
                        <p className="mt-2 text-xs text-foreground-light">Applied: {formatDate(application.created_at)}</p>
                      </div>

                      <div className="flex flex-col items-start gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusClass(application.status)}`}>
                          {application.status}
                        </span>
                        <select
                          value={application.status}
                          onChange={(e) => handleStatusChange(application.id, e.target.value as ApplicationStatus)}
                          disabled={updatingId === application.id || application.status === 'withdrawn'}
                          className="glass-input rounded-xl px-3 py-2 text-sm"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        {application.apply_url && (
                          <a href={application.apply_url} target="_blank" rel="noopener noreferrer" className="btn-secondary py-1.5 px-3 text-xs">
                            <Save className="mr-1 inline h-3 w-3" />
                            Job Link
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_260px_auto] md:items-end">
                      <label className="text-sm">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-foreground-light">Recruiter Notes</span>
                        <textarea
                          rows={2}
                          maxLength={500}
                          value={notesDraft[application.id] || ''}
                          onChange={(e) => setNotesDraft((prev) => ({ ...prev, [application.id]: e.target.value }))}
                          className="glass-input w-full rounded-xl px-3 py-2 text-sm"
                          placeholder="Feedback for candidate"
                        />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-foreground-light">Interview Date</span>
                        <input
                          type="datetime-local"
                          value={interviewDraft[application.id] || ''}
                          onChange={(e) => setInterviewDraft((prev) => ({ ...prev, [application.id]: e.target.value }))}
                          className="glass-input w-full rounded-xl px-3 py-2 text-sm"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleSaveRecruiterFields(application)}
                        disabled={savingFieldsId === application.id}
                        className="btn-secondary py-2 px-4 text-sm disabled:opacity-60"
                      >
                        Save Notes
                      </button>
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
