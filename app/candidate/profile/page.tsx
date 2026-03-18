'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Bookmark, Briefcase, House, MessageCircle, Plus, RefreshCcw, Save, Settings, Trash2, UploadCloud, UserRound } from 'lucide-react';
import { Header } from '@/components/Layout';
import { Toast, type ToastMessage } from '@/components/Toast';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { FirebaseError } from 'firebase/app';
import { isCandidateProfileComplete } from '@/lib/candidate-profile';
import { getCandidateApplications, type JobApplication } from '@/lib/applications';
import { formatDate } from '@/lib/utils';
import {
  addCandidateResumeRecord,
  getCandidateResumeHistory,
  markCandidateResumeDeleted,
  type CandidateResumeRecord,
  updateCandidateResumeSignedUrl,
} from '@/lib/resume-metadata';

type CandidateProfileForm = {
  full_name: string;
  phone: string;
  location: string;
  headline: string;
  about: string;
  experience_years: string;
  skills: string;
  resume_url: string;
};

type FieldErrors = Partial<Record<keyof CandidateProfileForm | 'links', string>>;

const COUNTRY_CODES = [
  { label: 'United States (+1)', value: '+1' },
  { label: 'India (+91)', value: '+91' },
  { label: 'United Kingdom (+44)', value: '+44' },
  { label: 'Canada (+1)', value: '+1' },
  { label: 'Australia (+61)', value: '+61' },
  { label: 'Germany (+49)', value: '+49' },
  { label: 'France (+33)', value: '+33' },
  { label: 'UAE (+971)', value: '+971' },
];

const EMPTY_FORM: CandidateProfileForm = {
  full_name: '',
  phone: '',
  location: '',
  headline: '',
  about: '',
  experience_years: '',
  skills: '',
  resume_url: '',
};

function normalizeDisplayName(raw: string, fallbackEmail?: string | null): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallbackEmail?.split('@')[0] || 'Candidate';

  const withoutLeadingNoise = cleaned.replace(/^[^A-Za-z]+/, '').trim();
  if (!withoutLeadingNoise) return fallbackEmail?.split('@')[0] || 'Candidate';

  return withoutLeadingNoise;
}

function sanitizePersonName(raw: string, fallbackEmail?: string | null): string {
  const display = normalizeDisplayName(raw, fallbackEmail);
  return display.replace(/\d+/g, '').replace(/\s+/g, ' ').trim() || (fallbackEmail?.split('@')[0] || 'Candidate');
}

function initialsFromName(name: string): string {
  const words = name
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);
  if (words.length === 0) return 'C';
  const initials = words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return initials || 'C';
}

function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatInternationalLocalPart(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 14);
}

function splitPhoneForEditing(raw: string): { countryCode: string; local: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { countryCode: '+1', local: '' };

  if (trimmed.startsWith('+')) {
    const compact = `+${trimmed.slice(1).replace(/\D/g, '')}`;
    const sortedCodes = [...new Set(COUNTRY_CODES.map((item) => item.value))].sort(
      (a, b) => b.length - a.length
    );
    const matched = sortedCodes.find((code) => compact.startsWith(code));
    if (matched) {
      return {
        countryCode: matched,
        local: compact.slice(matched.length).replace(/\D/g, ''),
      };
    }
    return { countryCode: '+1', local: compact.slice(1).replace(/\D/g, '') };
  }

  return { countryCode: '+1', local: trimmed.replace(/\D/g, '') };
}

function buildPhoneValue(countryCode: string, localPart: string): string {
  const digits = localPart.replace(/\D/g, '');
  if (!digits) return '';
  return `${countryCode}${digits}`;
}

function isValidPhoneNumber(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (trimmed.startsWith('+')) {
    const compact = trimmed.replace(/\s+/g, '');
    return /^\+[1-9]\d{7,14}$/.test(compact);
  }

  const digits = trimmed.replace(/\D/g, '');
  return digits.length === 10;
}

function firstLinkByHost(links: string[], host: string): string {
  return links.find((url) => {
    try {
      return new URL(url).hostname.includes(host);
    } catch {
      return false;
    }
  }) || '';
}

function firstPortfolioLikeLink(links: string[]): string {
  const first = links.find((url) => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return !hostname.includes('github.com') && !hostname.includes('linkedin.com');
    } catch {
      return false;
    }
  });
  return first || '';
}

function validateProfileForm(form: CandidateProfileForm, links: string[], countryCode: string): FieldErrors {
  const errors: FieldErrors = {};
  const years = Number(form.experience_years);
  const skillsList = form.skills
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);

  const normalizedName = sanitizePersonName(form.full_name);
  if (normalizedName.length < 3) {
    errors.full_name = 'Full name must be at least 3 characters.';
  } else if (/\d/.test(form.full_name)) {
    errors.full_name = 'Full name cannot contain numbers.';
  }
  if (!isValidPhoneNumber(buildPhoneValue(countryCode, form.phone))) {
    errors.phone = 'Enter valid phone: +1234567890 (8-15 digits) or 10-digit local number.';
  }
  if (form.location.trim().length < 2) errors.location = 'Location must be at least 2 characters.';
  if (form.headline.trim().length < 6) errors.headline = 'Headline must be at least 6 characters.';
  if (form.about.trim().length < 30) errors.about = 'About must be at least 30 characters.';
  if (skillsList.length === 0) {
    errors.skills = 'Add at least one skill.';
  } else if (skillsList.some((skill) => skill.length < 2)) {
    errors.skills = 'Each skill must be at least 2 characters.';
  }

  if (!form.experience_years.trim()) {
    errors.experience_years = 'Experience is required.';
  } else if (!Number.isFinite(years) || years < 0 || years > 50) {
    errors.experience_years = 'Experience must be between 0 and 50.';
  }

  if (!form.resume_url.trim()) {
    errors.resume_url = 'Resume URL is required.';
  } else if (!isHttpsUrl(form.resume_url.trim())) {
    errors.resume_url = 'Use a valid https:// resume URL.';
  }

  const nonEmptyLinks = links.map((link) => link.trim()).filter(Boolean);
  if (nonEmptyLinks.some((link) => !isHttpsUrl(link))) {
    errors.links = 'All professional links must be valid https:// URLs.';
  }

  return errors;
}

function computeProfileCompletion(form: CandidateProfileForm): number {
  const checks = [
    form.full_name.trim().length >= 3,
    form.phone.replace(/\D/g, '').length >= 7,
    form.location.trim().length >= 2,
    form.headline.trim().length >= 6,
    form.about.trim().length >= 30,
    form.skills.split(',').map((v) => v.trim()).filter(Boolean).length > 0,
    form.experience_years.trim().length > 0,
    form.resume_url.trim().length > 0,
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

export default function CandidateProfilePage() {
  const { user, isLoading, isSignedIn } = useAuth();
  const router = useRouter();
  const [isOnboardingFlow, setIsOnboardingFlow] = useState(false);
  const [form, setForm] = useState<CandidateProfileForm>(EMPTY_FORM);
  const [countryCode, setCountryCode] = useState('+1');
  const [links, setLinks] = useState<string[]>(['']);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [selectedResumeFile, setSelectedResumeFile] = useState<File | null>(null);
  const [resumeHistory, setResumeHistory] = useState<CandidateResumeRecord[]>([]);
  const [activeResumePath, setActiveResumePath] = useState('');
  const [isRenewingResume, setIsRenewingResume] = useState(false);
  const [autoRenewedPath, setAutoRenewedPath] = useState('');
  const [deletingResumeId, setDeletingResumeId] = useState<string | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<JobApplication[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const completion = computeProfileCompletion(form);
  const profileDisplayName = normalizeDisplayName(form.full_name, user?.email);
  const profileInitials = initialsFromName(profileDisplayName);
  const activeResumeRecord = resumeHistory.find((item) => !item.is_deleted && item.resume_path === activeResumePath)
    || resumeHistory.find((item) => !item.is_deleted)
    || null;

  const pushToast = useCallback((type: ToastMessage['type'], message: string) => {
    setToast({ id: Date.now(), type, message });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setIsOnboardingFlow(params.get('onboarding') === '1');
  }, []);

  useEffect(() => {
    if (!toast || toast.type === 'error') return;
    const timeout = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!isLoading && !isSignedIn) {
      router.replace('/login/candidate');
    }
  }, [isLoading, isSignedIn, router]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        const userProfileRef = doc(db, 'user_profiles', user.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        const data = userProfileSnap.data();
        const role = data?.role;

        if (role === 'admin') {
          router.replace('/admin');
          return;
        }
        if (role === 'company') {
          router.replace('/company');
          return;
        }

        const storedLinks = Array.isArray(data?.links)
          ? data.links.filter((value: unknown): value is string => typeof value === 'string')
          : [];

        const legacyLinks = [
          (data?.portfolio_url as string) || '',
          (data?.linkedin_url as string) || '',
          (data?.github_url as string) || '',
        ].filter(Boolean);

        const mergedLinks = Array.from(new Set([...storedLinks, ...legacyLinks].map((link) => link.trim()).filter(Boolean)));
        const parsedPhone = splitPhoneForEditing((data?.phone as string) || '');

        setForm({
          full_name: sanitizePersonName((data?.full_name as string) || '', user.email),
          phone: parsedPhone.local,
          location: (data?.location as string) || '',
          headline: (data?.headline as string) || '',
          about: (data?.about as string) || '',
          experience_years:
            typeof data?.experience_years === 'number' && Number.isFinite(data.experience_years)
              ? String(data.experience_years)
              : '',
          skills: Array.isArray(data?.skills) ? data.skills.join(', ') : ((data?.skills as string) || ''),
          resume_url: (data?.resume_url as string) || '',
        });
        setCountryCode(parsedPhone.countryCode);
        setLinks(mergedLinks.length > 0 ? mergedLinks : ['']);
      } catch (err) {
        console.error('Error loading candidate profile:', err);
        pushToast('error', 'Failed to load profile details.');
      } finally {
        setIsRoleLoading(false);
      }
    };

    if (!isLoading && isSignedIn && user) {
      loadProfile();
    } else if (!isLoading) {
      setIsRoleLoading(false);
    }
  }, [isLoading, isSignedIn, user, router, pushToast]);

  useEffect(() => {
    const loadAppliedJobs = async () => {
      if (!user || !isSignedIn) {
        setAppliedJobs([]);
        return;
      }
      try {
        const apps = await getCandidateApplications(user.uid);
        setAppliedJobs(apps);
      } catch (error) {
        console.error('Candidate applied jobs load error:', error);
        setAppliedJobs([]);
      }
    };
    loadAppliedJobs();
  }, [user, isSignedIn]);

  useEffect(() => {
    const loadResumeHistory = async () => {
      if (!user || !isSignedIn) {
        setResumeHistory([]);
        setActiveResumePath('');
        return;
      }
      const history = await getCandidateResumeHistory(user.uid);
      setResumeHistory(history);
      const latestActive = history.find((item) => !item.is_deleted);
      setActiveResumePath(latestActive?.resume_path || '');
    };
    loadResumeHistory();
  }, [user, isSignedIn]);

  useEffect(() => {
    if (form.resume_url.trim()) return;
    const latestActive = resumeHistory.find((item) => !item.is_deleted);
    if (latestActive?.resume_url) {
      setForm((prev) => ({ ...prev, resume_url: latestActive.resume_url }));
      setActiveResumePath(latestActive.resume_path);
    }
  }, [resumeHistory, form.resume_url]);

  const onChangeField = (field: keyof CandidateProfileForm, value: string) => {
    const nextValue =
      field === 'phone'
        ? formatInternationalLocalPart(value)
        : value;
    setForm((prev) => ({ ...prev, [field]: nextValue }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const onChangeLink = (index: number, value: string) => {
    setLinks((prev) => prev.map((link, idx) => (idx === index ? value : link)));
    setFieldErrors((prev) => ({ ...prev, links: undefined }));
  };

  const addLinkInput = () => {
    setLinks((prev) => [...prev, '']);
  };

  const removeLinkInput = (index: number) => {
    setLinks((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length > 0 ? next : [''];
    });
  };

  const uploadResumeFile = async () => {
    if (!user || !selectedResumeFile) return;

    setIsUploadingResume(true);
    setToast(null);

    try {
      const idToken = await user.getIdToken();
      const formData = new FormData();
      formData.append('resume', selectedResumeFile);

      const response = await fetch('/api/resume/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      });

      const payload = (await response.json()) as {
        resume_url?: string;
        resume_path?: string;
        expires_in_seconds?: number;
        expires_at?: string;
        error?: string;
      };
      if (!response.ok || !payload.resume_url || !payload.resume_path) {
        throw new Error(payload.error || 'Resume upload failed');
      }

      const expiresAt = payload.expires_at
        ? new Date(payload.expires_at)
        : new Date(Date.now() + (payload.expires_in_seconds || 0) * 1000);
      await addCandidateResumeRecord({
        userId: user.uid,
        fileName: selectedResumeFile.name,
        fileSize: selectedResumeFile.size,
        fileType: selectedResumeFile.type || 'application/octet-stream',
        resumePath: payload.resume_path,
        resumeUrl: payload.resume_url,
        expiresAt,
      });

      const history = await getCandidateResumeHistory(user.uid);
      setResumeHistory(history);
      setActiveResumePath(payload.resume_path);
      setForm((prev) => ({ ...prev, resume_url: payload.resume_url as string }));
      setSelectedResumeFile(null);
      setFieldErrors((prev) => ({ ...prev, resume_url: undefined }));
      pushToast('success', 'Resume uploaded successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload resume';
      pushToast('error', message);
    } finally {
      setIsUploadingResume(false);
    }
  };

  const renewResumeUrl = useCallback(async () => {
    if (!user || !activeResumeRecord) return;
    setIsRenewingResume(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/resume/renew', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resume_path: activeResumeRecord.resume_path }),
      });
      const payload = (await response.json()) as {
        resume_url?: string;
        expires_at?: string;
        expires_in_seconds?: number;
        error?: string;
      };
      if (!response.ok || !payload.resume_url) {
        throw new Error(payload.error || 'Could not renew resume URL');
      }

      const nextExpiresAt = payload.expires_at
        ? new Date(payload.expires_at)
        : new Date(Date.now() + (payload.expires_in_seconds || 0) * 1000);
      await updateCandidateResumeSignedUrl(activeResumeRecord.id, payload.resume_url, nextExpiresAt);
      setForm((prev) => ({ ...prev, resume_url: payload.resume_url as string }));
      setResumeHistory((prev) =>
        prev.map((item) =>
          item.id === activeResumeRecord.id
            ? {
                ...item,
                resume_url: payload.resume_url as string,
                expires_at: nextExpiresAt.toISOString(),
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );
      pushToast('success', 'Resume link renewed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to renew resume URL';
      pushToast('error', message);
    } finally {
      setIsRenewingResume(false);
    }
  }, [activeResumeRecord, pushToast, user]);

  useEffect(() => {
    if (!activeResumeRecord || isRenewingResume) return;
    if (autoRenewedPath === activeResumeRecord.resume_path) return;
    const expiresAtMs = Date.parse(activeResumeRecord.expires_at);
    if (!Number.isFinite(expiresAtMs)) return;
    const within24Hours = expiresAtMs - Date.now() < 24 * 60 * 60 * 1000;
    if (!within24Hours) return;
    setAutoRenewedPath(activeResumeRecord.resume_path);
    renewResumeUrl();
  }, [activeResumeRecord, isRenewingResume, autoRenewedPath, renewResumeUrl]);

  const deleteResume = async (record: CandidateResumeRecord) => {
    if (!user) return;
    setDeletingResumeId(record.id);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/resume/delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resume_path: record.resume_path }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Failed to delete resume from storage');
      }

      await markCandidateResumeDeleted(record.id);
      setResumeHistory((prev) =>
        prev.map((item) =>
          item.id === record.id
            ? { ...item, is_deleted: true, updated_at: new Date().toISOString() }
            : item
        )
      );
      const nextActive = resumeHistory.find((item) => item.id !== record.id && !item.is_deleted);
      setActiveResumePath(nextActive?.resume_path || '');
      if (activeResumePath === record.resume_path) {
        setForm((prev) => ({ ...prev, resume_url: nextActive?.resume_url || '' }));
      }
      pushToast('success', 'Resume deleted.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete resume';
      pushToast('error', message);
    } finally {
      setDeletingResumeId(null);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setToast(null);

    try {
      const errors = validateProfileForm(form, links, countryCode);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        pushToast('error', Object.values(errors)[0] as string);
        return;
      }

      const profileRef = doc(db, 'user_profiles', user.uid);
      const existing = await getDoc(profileRef);
      const skillsList = form.skills
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const normalizedLinks = Array.from(new Set(links.map((link) => link.trim()).filter(Boolean)));
      const parsedExperience = Number(form.experience_years);

      const payload = {
        email: user.email,
        role: 'candidate',
        full_name: sanitizePersonName(form.full_name, user.email),
        phone: buildPhoneValue(countryCode, form.phone),
        location: form.location.trim(),
        headline: form.headline.trim(),
        about: form.about.trim(),
        experience_years: Number.isFinite(parsedExperience) ? parsedExperience : null,
        skills: skillsList,
        links: normalizedLinks,
        portfolio_url: firstPortfolioLikeLink(normalizedLinks),
        linkedin_url: firstLinkByHost(normalizedLinks, 'linkedin.com'),
        github_url: firstLinkByHost(normalizedLinks, 'github.com'),
        resume_url: form.resume_url.trim(),
        updated_at: serverTimestamp(),
        created_at: existing.exists() ? existing.data()?.created_at || serverTimestamp() : serverTimestamp(),
      };

      if (!isCandidateProfileComplete(payload as Record<string, unknown>)) {
        pushToast('error', 'Please complete all required candidate profile details.');
        return;
      }

      await setDoc(profileRef, payload, { merge: true });
      if (isOnboardingFlow) {
        router.replace('/candidate');
        return;
      }

      pushToast('success', 'Candidate profile saved.');
    } catch (err) {
      console.error('Error saving candidate profile:', err);
      if (err instanceof FirebaseError && err.code === 'permission-denied') {
        pushToast('error', 'Missing Firestore permission for user profile update.');
      } else {
        pushToast('error', 'Failed to save candidate profile.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = (field: keyof CandidateProfileForm) =>
    `auth-input w-full px-3 text-sm text-foreground outline-none ${fieldErrors[field] ? 'border-red-500' : ''}`;

  if (isLoading || isRoleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
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
          <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[290px_1fr]">
          <aside className="lg:sticky lg:top-24 h-fit">
            <section className="glass rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyber-purple text-xl font-extrabold tracking-wide text-white">
                  {profileInitials}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground leading-tight">
                    {profileDisplayName}
                  </h2>
                  <p className="text-sm text-foreground-muted mt-1">{form.headline.trim() || 'Complete your details'}</p>
                  <p className="text-sm text-foreground-light">{form.location.trim() || 'Location not set'}</p>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs text-foreground-muted">
                  <span>Profile completion</span>
                  <span>{completion}%</span>
                </div>
                <div className="h-2 rounded-full bg-background-secondary/80">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-cyber-purple to-electric-blue transition-all duration-300"
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2 border-t border-glass-border pt-4">
                <Link href="/" className="btn-secondary text-center py-2 px-4">Browse Jobs</Link>
                <Link href="/candidate" className="btn-secondary text-center py-2 px-4">Dashboard</Link>
              </div>

              <nav className="mt-5 space-y-2 border-t border-glass-border pt-4">
                <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <House className="h-4 w-4" />
                  Discover
                </Link>
                <Link href="/candidate/applications" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <Briefcase className="h-4 w-4" />
                  Applications
                </Link>
                <Link href="/candidate" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <Bookmark className="h-4 w-4" />
                  Saved
                </Link>
                <Link href="/candidate/notifications" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <MessageCircle className="h-4 w-4" />
                  Messages
                </Link>
                <div className="flex items-center gap-3 rounded-xl bg-background-secondary/80 px-3 py-2 text-sm font-bold text-foreground">
                  <UserRound className="h-4 w-4" />
                  My Profile
                </div>
                <Link href="/candidate/settings" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <Settings className="h-4 w-4" />
                  Account Settings
                </Link>
              </nav>
            </section>
          </aside>

          <div>
            <section className="glass rounded-xl p-6 md:p-8 mb-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-glass-border/70 px-3 py-1 text-xs uppercase tracking-[0.16em] text-electric-blue/90 mb-3">
                <UserRound className="w-3.5 h-3.5" />
                Candidate Profile
              </div>
              <h1 className="text-3xl font-bold text-foreground">Full Details</h1>
              <p className="text-foreground-muted mt-2">Complete your profile to look more professional to recruiters.</p>
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-xs text-foreground-muted">
                  <span>Profile completion</span>
                  <span>{completion}%</span>
                </div>
                <div className="h-2 rounded-full bg-background-secondary/80">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-cyber-purple to-electric-blue transition-all duration-300"
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>
            </section>

            <form onSubmit={saveProfile} className="glass rounded-xl p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-foreground-light text-sm font-medium mb-2">Full Name</label>
              <input type="text" value={form.full_name} onChange={(e) => onChangeField('full_name', e.target.value)} className={inputClass('full_name')} placeholder="Your full name" required />
              {fieldErrors.full_name && <p className="mt-1 text-xs text-red-500">{fieldErrors.full_name}</p>}
            </div>
            <div>
              <label className="block text-foreground-light text-sm font-medium mb-2">Phone</label>
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="auth-input px-2 text-sm text-foreground outline-none"
                >
                  {COUNTRY_CODES.map((item) => (
                    <option key={`${item.label}-${item.value}`} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => onChangeField('phone', e.target.value)}
                  className={inputClass('phone')}
                  placeholder="Phone number"
                  required
                />
              </div>
              <p className="mt-1 text-xs text-foreground-muted">Stored as {countryCode} + number (international format).</p>
              {fieldErrors.phone && <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>}
            </div>
            <div>
              <label className="block text-foreground-light text-sm font-medium mb-2">Location</label>
              <input type="text" value={form.location} onChange={(e) => onChangeField('location', e.target.value)} className={inputClass('location')} placeholder="City, Country" required />
              {fieldErrors.location && <p className="mt-1 text-xs text-red-500">{fieldErrors.location}</p>}
            </div>
            <div>
              <label className="block text-foreground-light text-sm font-medium mb-2">Experience (Years)</label>
              <input type="number" min="0" max="50" value={form.experience_years} onChange={(e) => onChangeField('experience_years', e.target.value)} className={inputClass('experience_years')} placeholder="3" required />
              {fieldErrors.experience_years && <p className="mt-1 text-xs text-red-500">{fieldErrors.experience_years}</p>}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-foreground-light text-sm font-medium">Professional Headline</label>
              <span className="text-xs text-foreground-muted">{form.headline.length}/100</span>
            </div>
            <input type="text" maxLength={100} value={form.headline} onChange={(e) => onChangeField('headline', e.target.value)} className={inputClass('headline')} placeholder="Frontend Engineer | React | TypeScript" required />
            {fieldErrors.headline && <p className="mt-1 text-xs text-red-500">{fieldErrors.headline}</p>}
          </div>

          <div>
            <label className="block text-foreground-light text-sm font-medium mb-2">Skills (comma separated)</label>
            <input type="text" value={form.skills} onChange={(e) => onChangeField('skills', e.target.value)} className={inputClass('skills')} placeholder="React, TypeScript, Node.js, Firebase" required />
            {fieldErrors.skills && <p className="mt-1 text-xs text-red-500">{fieldErrors.skills}</p>}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-foreground-light text-sm font-medium">About</label>
              <span className="text-xs text-foreground-muted">{form.about.length}/800</span>
            </div>
            <textarea
              maxLength={800}
              value={form.about}
              onChange={(e) => onChangeField('about', e.target.value)}
              className={`${inputClass('about')} py-3 min-h-[140px] resize-y`}
              placeholder="Write a short professional summary..."
              required
            />
            {fieldErrors.about && <p className="mt-1 text-xs text-red-500">{fieldErrors.about}</p>}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-foreground-light text-sm font-medium">Professional Links (Optional)</label>
              <button type="button" onClick={addLinkInput} className="btn-secondary py-1.5 px-3 text-xs inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add More Link
              </button>
            </div>
            {links.map((linkValue, index) => (
              <div key={`link-${index}`} className="flex items-center gap-2">
                <input
                  type="url"
                  value={linkValue}
                  onChange={(e) => onChangeLink(index, e.target.value)}
                  className={`auth-input w-full px-3 text-sm text-foreground outline-none ${fieldErrors.links ? 'border-red-500' : ''}`}
                  placeholder="https://linkedin.com/in/username or https://github.com/username"
                />
                <button
                  type="button"
                  onClick={() => removeLinkInput(index)}
                  className="btn-secondary py-2 px-3 inline-flex items-center justify-center"
                  aria-label={`Remove link ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {fieldErrors.links && <p className="mt-1 text-xs text-red-500">{fieldErrors.links}</p>}
          </div>

          <div>
            <label className="block text-foreground-light text-sm font-medium mb-2">Resume URL</label>
            <input
              type="url"
              value={form.resume_url}
              onChange={(e) => onChangeField('resume_url', e.target.value)}
              className={inputClass('resume_url')}
              placeholder="Paste resume link or upload below"
              required
            />
            {fieldErrors.resume_url && <p className="mt-1 text-xs text-red-500">{fieldErrors.resume_url}</p>}
            <div className="mt-3 rounded-xl border border-glass-border p-3">
              <p className="text-xs text-foreground-muted mb-2">
                Free upload: PDF, DOC, DOCX up to 5MB.
              </p>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setSelectedResumeFile(e.target.files?.[0] || null)}
                  className="text-sm text-foreground-light"
                />
                <button
                  type="button"
                  onClick={uploadResumeFile}
                  disabled={!selectedResumeFile || isUploadingResume}
                  className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
                >
                  <UploadCloud className="h-4 w-4" />
                  {isUploadingResume ? 'Uploading...' : 'Upload Resume'}
                </button>
                <button
                  type="button"
                  onClick={renewResumeUrl}
                  disabled={!activeResumeRecord || isRenewingResume}
                  className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
                >
                  <RefreshCcw className={`h-4 w-4 ${isRenewingResume ? 'animate-spin' : ''}`} />
                  {isRenewingResume ? 'Renewing...' : 'Renew Link'}
                </button>
              </div>

              {activeResumeRecord && (
                <p className="mt-2 text-xs text-foreground-light">
                  Current resume expires on {formatDate(activeResumeRecord.expires_at)}
                </p>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-glass-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-light">Upload History</p>
              {resumeHistory.filter((item) => !item.is_deleted).length === 0 ? (
                <p className="mt-2 text-xs text-foreground-muted">No uploaded resumes yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {resumeHistory.filter((item) => !item.is_deleted).slice(0, 5).map((item) => (
                    <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-glass-border px-3 py-2 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">{item.file_name}</p>
                        <p className="text-[11px] text-foreground-muted">
                          Uploaded {formatDate(item.created_at)} • Expires {formatDate(item.expires_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveResumePath(item.resume_path);
                            setForm((prev) => ({ ...prev, resume_url: item.resume_url }));
                          }}
                          className="btn-secondary px-2.5 py-1 text-[11px]"
                        >
                          Use
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteResume(item)}
                          disabled={deletingResumeId === item.id}
                          className="btn-secondary px-2.5 py-1 text-[11px] text-red-300 disabled:opacity-60"
                        >
                          {deletingResumeId === item.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary inline-flex items-center gap-2 py-2 px-5 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
            </form>

            <section className="glass rounded-xl p-6 md:p-8 mt-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Applied Jobs</h2>
                  <p className="text-foreground-muted mt-1">Recent applications from your profile.</p>
                </div>
                <Link href="/candidate/applications" className="btn-secondary py-1.5 px-3 text-xs">
                  View All
                </Link>
              </div>
              {appliedJobs.length === 0 ? (
                <div className="mt-5 rounded-xl border border-glass-border p-5 text-sm text-foreground-muted">
                  No applied jobs yet.
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-xl border border-glass-border">
                  {appliedJobs.slice(0, 6).map((item, index) => (
                    <article
                      key={item.id}
                      className={`flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between ${index !== 0 ? 'border-t border-glass-border' : ''}`}
                    >
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-foreground">{item.job_title}</h3>
                        <p className="truncate text-xs text-foreground-muted">{item.company_name}</p>
                        <p className="mt-0.5 text-[11px] text-foreground-light">Applied: {formatDate(item.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-glass-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                          {item.status}
                        </span>
                        <Link href={`/jobs/${item.job_id}`} className="btn-secondary py-1 px-2.5 text-[11px]">
                          Open
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
