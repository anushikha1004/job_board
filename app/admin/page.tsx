'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { BarChart3, CheckCircle2, ClipboardList, ShieldAlert, Users } from 'lucide-react';
import { Header } from '@/components/Layout';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { logAudit } from '@/lib/audit';
import { getAdminMetrics, getAuditLogs, getRecentJobs, adminSetJobStatus, type AdminMetrics, type AuditLogEntry } from '@/lib/admin';
import { formatDate } from '@/lib/utils';

export default function AdminDashboardPage() {
  const { user, isLoading, isSignedIn } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<'admin' | 'candidate' | 'company' | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [recentJobs, setRecentJobs] = useState<Array<{ id: string; title: string; company_name: string; status?: string }>>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isSignedIn) {
      router.replace('/login/candidate');
    }
  }, [isLoading, isSignedIn, router]);

  useEffect(() => {
    const loadRole = async () => {
      if (!user) return;
      try {
        const profileSnap = await getDoc(doc(db, 'user_profiles', user.uid));
        const nextRole = profileSnap.data()?.role as 'admin' | 'candidate' | 'company' | undefined;
        setRole(nextRole || null);
        if (nextRole !== 'admin') {
          router.replace('/dashboard');
        } else {
          await logAudit({
            actor_id: user.uid,
            actor_role: 'admin',
            action: 'admin.login',
            target_type: 'user',
            target_id: user.uid,
          });
        }
      } catch (error) {
        console.error('Admin role load error:', error);
        router.replace('/dashboard');
      }
    };
    if (!isLoading && isSignedIn && user) {
      loadRole();
    }
  }, [isLoading, isSignedIn, user, router]);

  useEffect(() => {
    const loadData = async () => {
      if (role !== 'admin') {
        setIsLoadingData(false);
        return;
      }
      setIsLoadingData(true);
      const [metricsData, logsData, jobsData] = await Promise.all([
        getAdminMetrics(),
        getAuditLogs(40),
        getRecentJobs(8),
      ]);
      setMetrics(metricsData);
      setAuditLogs(logsData);
      setRecentJobs(jobsData);
      setIsLoadingData(false);
    };
    loadData();
  }, [role]);

  const funnel = useMemo(() => {
    if (!metrics) return null;
    const candidates = metrics.totalCandidates || 0;
    const applications = metrics.totalApplications || 0;
    const hires = metrics.hiredApplications || 0;
    const applicationsRate = candidates ? Math.round((applications / candidates) * 100) : 0;
    const hiresRate = applications ? Math.round((hires / applications) * 100) : 0;
    return { candidates, applications, hires, applicationsRate, hiresRate };
  }, [metrics]);

  const handleJobStatusChange = async (jobId: string, status: 'open' | 'archived') => {
    if (!user) return;
    setStatusUpdatingId(jobId);
    try {
      await adminSetJobStatus(jobId, status);
      await logAudit({
        actor_id: user.uid,
        actor_role: 'admin',
        action: status === 'archived' ? 'job.archived' : 'job.reopened',
        target_type: 'job',
        target_id: jobId,
      });
      const jobsData = await getRecentJobs(8);
      setRecentJobs(jobsData);
    } catch (error) {
      console.error('Admin job status update error:', error);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  if (isLoading || isLoadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground">Loading admin dashboard...</div>
      </div>
    );
  }

  if (!user || role !== 'admin') {
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
        <section className="glass rounded-2xl p-7 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="pill">Admin Operations</p>
              <h1 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">TechHire Ops Center</h1>
              <p className="mt-2 text-foreground-muted">Monitor platform health, compliance, and growth signals.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-glass-border px-4 py-2 text-xs text-foreground-light">
              <ShieldAlert className="h-4 w-4 text-electric-blue" />
              Admin access verified
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="metric-card">
            <div className="flex items-center justify-between">
              <p className="metric-label">Open Jobs</p>
              <ClipboardList className="h-5 w-5 text-electric-blue" />
            </div>
            <p className="mt-3 metric-value">{metrics?.openJobs ?? 0}</p>
            <p className="text-xs text-foreground-light">Total jobs: {metrics?.totalJobs ?? 0}</p>
          </div>
          <div className="metric-card">
            <div className="flex items-center justify-between">
              <p className="metric-label">Applications</p>
              <BarChart3 className="h-5 w-5 text-electric-blue" />
            </div>
            <p className="mt-3 metric-value">{metrics?.totalApplications ?? 0}</p>
            <p className="text-xs text-foreground-light">Hires: {metrics?.hiredApplications ?? 0}</p>
          </div>
          <div className="metric-card">
            <div className="flex items-center justify-between">
              <p className="metric-label">Candidates</p>
              <Users className="h-5 w-5 text-electric-blue" />
            </div>
            <p className="mt-3 metric-value">{metrics?.totalCandidates ?? 0}</p>
            <p className="text-xs text-foreground-light">New (30d): {metrics?.createdLast30Days.candidates ?? 0}</p>
          </div>
          <div className="metric-card">
            <div className="flex items-center justify-between">
              <p className="metric-label">Recruiters</p>
              <CheckCircle2 className="h-5 w-5 text-electric-blue" />
            </div>
            <p className="mt-3 metric-value">{metrics?.totalRecruiters ?? 0}</p>
            <p className="text-xs text-foreground-light">New (30d): {metrics?.createdLast30Days.recruiters ?? 0}</p>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-xl font-bold text-foreground">Conversion Funnel</h2>
            <p className="text-sm text-foreground-muted mt-2">Candidate to hire flow (lifetime).</p>
            {funnel ? (
              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs text-foreground-light">
                    <span>Candidates</span>
                    <span>{funnel.candidates}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-background-secondary/80">
                    <div className="h-2 rounded-full bg-gradient-to-r from-electric-blue to-cyber-purple" style={{ width: '100%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs text-foreground-light">
                    <span>Applications</span>
                    <span>{funnel.applications} ({funnel.applicationsRate}%)</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-background-secondary/80">
                    <div className="h-2 rounded-full bg-gradient-to-r from-electric-blue to-cyber-purple" style={{ width: `${Math.min(funnel.applicationsRate, 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs text-foreground-light">
                    <span>Hires</span>
                    <span>{funnel.hires} ({funnel.hiresRate}%)</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-background-secondary/80">
                    <div className="h-2 rounded-full bg-gradient-to-r from-electric-blue to-cyber-purple" style={{ width: `${Math.min(funnel.hiresRate, 100)}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-foreground-muted">Funnel data unavailable.</p>
            )}
          </div>

          <div className="glass rounded-2xl p-6">
            <h2 className="text-xl font-bold text-foreground">Recent Jobs</h2>
            <p className="text-sm text-foreground-muted mt-2">Quick moderation actions.</p>
            {recentJobs.length === 0 ? (
              <p className="mt-4 text-foreground-muted">No recent jobs found.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {recentJobs.map((job) => (
                  <div key={job.id} className="rounded-xl border border-glass-border px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{job.title}</p>
                        <p className="text-xs text-foreground-muted">{job.company_name}</p>
                      </div>
                      <span className="rounded-full border border-glass-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-foreground-light">
                        {job.status || 'open'}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleJobStatusChange(job.id, job.status === 'archived' ? 'open' : 'archived')}
                        disabled={statusUpdatingId === job.id}
                        className="btn-secondary px-3 py-1 text-xs disabled:opacity-60"
                      >
                        {statusUpdatingId === job.id
                          ? 'Updating...'
                          : job.status === 'archived'
                            ? 'Reopen Job'
                            : 'Archive Job'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-xl font-bold text-foreground">Audit Logs</h2>
            <p className="text-sm text-foreground-muted mt-2">Latest critical actions.</p>
            {auditLogs.length === 0 ? (
              <p className="mt-4 text-foreground-muted">No audit activity yet.</p>
            ) : (
              <div className="mt-4 glass-table">
                {auditLogs.map((entry) => (
                  <div key={entry.id} className="glass-table-row">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{entry.action}</p>
                        <p className="text-xs text-foreground-muted">
                          {entry.actor_role} • {entry.actor_id} • {entry.target_type} {entry.target_id}
                        </p>
                      </div>
                      <span className="text-xs text-foreground-light">{formatDate(entry.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="glass rounded-2xl p-6">
            <h2 className="text-xl font-bold text-foreground">Ops Checklist</h2>
            <p className="text-sm text-foreground-muted mt-2">Quick health reminders before launch.</p>
            <ul className="mt-4 space-y-3 text-sm text-foreground-light">
              <li className="soft-divider pt-3">Verify Firebase rules deployed</li>
              <li className="soft-divider pt-3">Confirm resume storage + signed URLs</li>
              <li className="soft-divider pt-3">Review flagged jobs and reports daily</li>
              <li className="soft-divider pt-3">Monitor funnel drop-off weekly</li>
            </ul>
          </div>
        </section>

      </main>
    </div>
  );
}
