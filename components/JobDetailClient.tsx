"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Globe, MapPin, Users, ShieldAlert, UserRound, X } from 'lucide-react';
import { Header } from '@/components/Layout';
import { useAuth } from '@/lib/auth-context';
import { deleteJobById, getCompanyProfileByUserId, getJobById, getSimilarJobs } from '@/lib/firestore';
import {
  applyToJob,
  getCompanyApplications,
  hasCandidateApplied,
  type JobApplication,
} from '@/lib/applications';
import { formatDate } from '@/lib/utils';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Toast, type ToastMessage } from '@/components/Toast';
import type { Job } from '@/types/job';
import type { CompanyProfile } from '@/types/company';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logAudit } from '@/lib/audit';

interface Props {
  jobId: string;
}

function sanitizeCandidateName(raw: string, fallbackEmail?: string | null): string {
  const compact = raw.replace(/\s+/g, ' ').trim();
  if (!compact) return fallbackEmail?.split('@')[0] || 'Candidate';
  const withoutLeadingNoise = compact.replace(/^[^A-Za-z]+/, '').trim();
  const withoutDigits = withoutLeadingNoise.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  return withoutDigits || fallbackEmail?.split('@')[0] || 'Candidate';
}

export default function JobDetailClient({ jobId }: Props) {
  const [job, setJob] = useState<Job | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [similarJobs, setSimilarJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('Misleading or fake job');
  const [reportDetails, setReportDetails] = useState('');
  const [reportFeedback, setReportFeedback] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [userRole, setUserRole] = useState<'candidate' | 'company' | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [jobApplicants, setJobApplicants] = useState<JobApplication[]>([]);
  const { user, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const currentJob = await getJobById(jobId);
        if (!mounted) return;
        setJob(currentJob);
        if (!currentJob) return;

        const [profile, related] = await Promise.all([
          currentJob.postedBy ? getCompanyProfileByUserId(currentJob.postedBy) : Promise.resolve(null),
          getSimilarJobs(currentJob, 3),
        ]);

        if (!mounted) return;
        setCompanyProfile(profile);
        setSimilarJobs(related);
      } catch (err) {
        console.error('Error loading job details:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [jobId]);

  useEffect(() => {
    if (!toast || toast.type === 'error') return;
    const timeout = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const loadUserContext = async () => {
      if (!user) {
        setUserRole(null);
        setCandidateName('');
        return;
      }

      try {
        const userProfileSnap = await getDoc(doc(db, 'user_profiles', user.uid));
        const role = userProfileSnap.data()?.role;
        setUserRole(role === 'company' ? 'company' : 'candidate');
        const profileName = (userProfileSnap.data()?.full_name as string) || '';
        setCandidateName(sanitizeCandidateName(profileName, user.email));
      } catch (err) {
        console.error('Error loading user role:', err);
        setUserRole('candidate');
        setCandidateName(sanitizeCandidateName('', user.email));
      }
    };

    loadUserContext();
  }, [user]);

  useEffect(() => {
    const loadApplicants = async () => {
      if (!user || !job) {
        setJobApplicants([]);
        return;
      }
      if (userRole !== 'company' || user.uid !== job.postedBy) {
        setJobApplicants([]);
        return;
      }

      try {
        const apps = await getCompanyApplications(user.uid);
        setJobApplicants(apps.filter((item) => item.job_id === job.id));
      } catch (error) {
        console.error('Job applicants load error:', error);
        setJobApplicants([]);
      }
    };
    loadApplicants();
  }, [user, userRole, job]);

  useEffect(() => {
    const loadAppliedState = async () => {
      if (!isSignedIn || !user || !job) {
        setAlreadyApplied(false);
        return;
      }
      if (userRole !== 'candidate') {
        setAlreadyApplied(false);
        return;
      }

      const applied = await hasCandidateApplied(user.uid, job.id);
      setAlreadyApplied(applied);
    };

    loadAppliedState();
  }, [isSignedIn, user, userRole, job]);

  const jobStructuredData = useMemo(() => {
    if (!job) return '';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://techhire.example.com';
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: job.title,
      description: job.description || `${job.title} at ${job.company_name}`,
      datePosted: job.created_at,
      employmentType: job.type || 'FULL_TIME',
      hiringOrganization: {
        '@type': 'Organization',
        name: companyProfile?.company_name || job.company_name,
        sameAs: companyProfile?.website || undefined,
      },
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: companyProfile?.location || job.location || 'Remote',
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
      url: `${siteUrl}/jobs/${job.id}`,
    });
  }, [job, companyProfile]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!job) return <div className="p-6">Job not found.</div>;

  const descriptionBlocks = (job.description || '')
    .split('\n')
    .map((section) => section.trim())
    .filter(Boolean);

  const submitReport = () => {
    const reportSubject = encodeURIComponent(`Report job listing: ${job.title}`);
    const reportBody = encodeURIComponent(
      `Job ID: ${job.id}\nCompany: ${job.company_name}\nReason: ${reportReason}\nDetails: ${reportDetails || 'N/A'}`
    );
    window.location.href = `mailto:trust@techhire.com?subject=${reportSubject}&body=${reportBody}`;
    setShowReportForm(false);
    setReportFeedback('Report draft opened in your email app.');
    setReportDetails('');
  };

  const handleDelete = async () => {
    try {
      await deleteJobById(job.id);
      if (user) {
        await logAudit({
          actor_id: user.uid,
          actor_role: userRole === 'company' ? 'company' : 'admin',
          action: 'job.deleted',
          target_type: 'job',
          target_id: job.id,
        });
      }
      setToast({
        id: Date.now(),
        type: 'success',
        message: 'Job deleted successfully.',
      });
      router.push('/company');
    } catch (err) {
      console.error('Delete failed:', err);
      setToast({
        id: Date.now(),
        type: 'error',
        message: 'Failed to delete this job. Please try again.',
      });
    }
  };

  const handleApply = async () => {
    if (!job) return;

    if (!isSignedIn || !user) {
      router.push(`/login/candidate?next=${encodeURIComponent(`/jobs/${job.id}`)}`);
      return;
    }

    if (userRole === 'company') {
      setToast({
        id: Date.now(),
        type: 'error',
        message: 'Recruiter accounts cannot apply for jobs.',
      });
      return;
    }

    setIsApplying(true);
    try {
      await applyToJob({
        candidateId: user.uid,
        candidateName,
        candidateEmail: user.email || '',
        companyId: job.postedBy || '',
        jobId: job.id,
        jobTitle: job.title,
        companyName: job.company_name,
        applyUrl: job.apply_url,
        location: job.location,
        type: job.type,
      });
      setAlreadyApplied(true);
      setToast({
        id: Date.now(),
        type: 'success',
        message: 'Application submitted successfully.',
      });

      if (job.apply_url) {
        window.open(job.apply_url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Apply failed:', err);
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message || '')
          : '';
      if (message === 'ALREADY_APPLIED') {
        setAlreadyApplied(true);
        setToast({
          id: Date.now(),
          type: 'success',
          message: 'You already applied for this job.',
        });
        return;
      }
      setToast({
        id: Date.now(),
        type: 'error',
        message: 'Failed to submit application. Please try again.',
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jobStructuredData }} />
      <Header />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 glass rounded-xl p-7">
          <h1 className="text-3xl font-bold mb-3">{job.title}</h1>
          <p className="text-base text-foreground-light mb-6">
            {job.company_name} • {job.location || 'Remote'} • {job.type || 'Full-time'}
          </p>

          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold mb-2">Role Overview</h2>
              <p className="text-foreground-muted leading-relaxed">
                {descriptionBlocks[0] || 'No role summary provided.'}
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-2">Responsibilities & Details</h2>
              {descriptionBlocks.length > 1 ? (
                <ul className="list-disc pl-5 space-y-2 text-foreground-muted">
                  {descriptionBlocks.slice(1).map((block, idx) => (
                    <li key={`${job.id}-detail-${idx}`}>{block}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-foreground-muted leading-relaxed">
                  Full responsibilities will be discussed during the application process.
                </p>
              )}
            </div>

            {job.tags?.length ? (
              <div>
                <h2 className="text-xl font-semibold mb-2">Tech Stack</h2>
                <div className="flex flex-wrap gap-2">
                  {job.tags.map((tag) => (
                    <span key={`${job.id}-${tag}`} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          </section>

          <aside className="space-y-6">
            <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Company Info</h3>

            <div className="space-y-3 text-sm text-foreground-light">
              <div className="flex items-start gap-2">
                <Building2 className="w-4 h-4 mt-0.5 text-electric-blue" />
                <div>
                  <div className="font-medium">{companyProfile?.company_name || job.company_name}</div>
                  <div className="text-foreground-muted">Hiring organization</div>
                </div>
              </div>

              {companyProfile?.website && (
                <div className="flex items-start gap-2">
                  <Globe className="w-4 h-4 mt-0.5 text-electric-blue" />
                  <a href={companyProfile.website} target="_blank" rel="noopener noreferrer" className="hover:text-electric-blue transition">
                    {companyProfile.website}
                  </a>
                </div>
              )}

              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-electric-blue" />
                <span>{companyProfile?.location || job.location || 'Location not specified'}</span>
              </div>

              {companyProfile?.size && (
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 mt-0.5 text-electric-blue" />
                  <span>{companyProfile.size}</span>
                </div>
              )}
            </div>

            {companyProfile?.about && (
              <p className="text-sm text-foreground-muted leading-relaxed mt-4 border-t border-glass-border pt-4">
                {companyProfile.about}
              </p>
            )}

            {!companyProfile?.about && !companyProfile?.website && !companyProfile?.size && !companyProfile?.location && (
              <p className="text-sm text-foreground-muted leading-relaxed mt-4 border-t border-glass-border pt-4">
                Company profile details will appear here as the employer completes their profile.
              </p>
            )}
            </div>

            <div className="glass rounded-xl p-6">
            <div className="text-sm text-foreground-light mb-4">Posted: {formatDate(job.created_at)}</div>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={handleApply}
                disabled={isApplying || alreadyApplied}
                className="btn-primary disabled:opacity-60"
              >
                {alreadyApplied ? 'Applied' : isApplying ? 'Applying...' : 'Apply Now'}
              </button>
              {user?.uid === job.postedBy && (
                <button onClick={() => setIsDeleteModalOpen(true)} className="btn-secondary">Delete Job</button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowReportForm((prev) => !prev)}
              className="inline-flex items-center gap-2 text-sm text-foreground-muted hover:text-neon-pink transition"
            >
              <ShieldAlert className="w-4 h-4" />
              Report this listing
            </button>
            {reportFeedback && <p className="mt-2 text-xs text-foreground-muted">{reportFeedback}</p>}

            {showReportForm && (
              <div className="mt-4 rounded-lg border border-glass-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Report Job</h4>
                  <button
                    type="button"
                    onClick={() => setShowReportForm(false)}
                    className="text-foreground-muted hover:text-foreground transition"
                    aria-label="Close report form"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-glass-background border border-glass-border rounded-lg px-3 py-2 text-sm"
                >
                  <option>Misleading or fake job</option>
                  <option>Spam or duplicate listing</option>
                  <option>Offensive content</option>
                  <option>Broken apply link</option>
                </select>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  rows={3}
                  placeholder="Add details (optional)"
                  className="w-full bg-glass-background border border-glass-border rounded-lg px-3 py-2 text-sm resize-none"
                />
                <button type="button" onClick={submitReport} className="btn-secondary text-sm">
                  Continue in Email
                </button>
              </div>
            )}
            </div>

            {userRole === 'company' && user?.uid === job.postedBy && (
              <div className="glass rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Applicants ({jobApplicants.length})</h3>
                {jobApplicants.length === 0 ? (
                  <p className="text-sm text-foreground-muted">No candidates have applied yet.</p>
                ) : (
                  <div className="space-y-3">
                    {jobApplicants.map((applicant) => (
                      <div key={applicant.id} className="rounded-lg border border-glass-border px-3 py-2">
                        <p className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
                          <UserRound className="h-4 w-4 text-electric-blue" />
                          {applicant.candidate_name}
                        </p>
                        <p className="mt-1 text-xs text-foreground-muted">{applicant.candidate_email}</p>
                        <p className="mt-1 text-xs text-foreground-light uppercase tracking-wide">{applicant.status}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Similar Jobs</h3>
            {similarJobs.length > 0 ? (
              <div className="space-y-3">
                {similarJobs.map((similar) => (
                  <Link
                    key={similar.id}
                    href={`/jobs/${similar.id}`}
                    className="block rounded-lg border border-glass-border p-3 hover:border-electric-blue/50 transition"
                  >
                    <div className="font-medium">{similar.title}</div>
                    <div className="text-xs text-foreground-muted">
                      {similar.company_name} • {similar.location || 'Remote'}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-foreground-muted">
                No close matches yet. Check back soon for related roles.
              </p>
            )}
            </div>
          </aside>
        </div>
      </main>

      <footer className="glass glass-heavy mt-10 py-8">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 mb-8">
            <div>
              <h4 className="text-foreground font-semibold mb-4">About</h4>
              <p className="text-foreground-muted text-sm">
                TechHire connects candidates and recruiters with role-focused workflows, clear application tracking, and verified opportunities.
              </p>
              <Link href="/about" className="mt-3 inline-flex text-sm font-semibold text-cyber-purple hover:text-electric-blue transition">
                Read full About page
              </Link>
            </div>
            <div>
              <h4 className="text-foreground font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-foreground-muted">
                <li><Link href="/" className="hover:text-cyber-purple transition">Browse Jobs</Link></li>
                <li><Link href="/about" className="hover:text-cyber-purple transition">About TechHire</Link></li>
                <li><Link href="/company" className="hover:text-cyber-purple transition">Post a Job</Link></li>
                <li><Link href="/privacy" className="hover:text-cyber-purple transition">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-cyber-purple transition">Terms</Link></li>
                <li><Link href="/contact" className="hover:text-cyber-purple transition">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-glass-border pt-8">
            <p className="text-center text-foreground-muted text-sm">© 2026 TechHire. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <div className="fixed bottom-5 right-5 z-50 w-full max-w-sm px-4 sm:px-0">
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
      <ConfirmModal
        open={isDeleteModalOpen}
        title="Delete Job Posting"
        description="This action cannot be undone. Are you sure you want to delete this job?"
        confirmLabel="Delete"
        onCancel={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          setIsDeleteModalOpen(false);
          handleDelete();
        }}
      />
    </div>
  );
}
