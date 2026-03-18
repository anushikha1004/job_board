import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './logger';
import { logAudit } from './audit';
import {
  canSendCandidateEmail,
  getRawAccountSettingsByUserId,
  normalizeCandidateSettings,
} from './account-settings';

const APPLICATIONS_COLLECTION = 'applications';

export type ApplicationStatus =
  | 'submitted'
  | 'reviewed'
  | 'interviewing'
  | 'shortlisted'
  | 'withdrawn'
  | 'rejected'
  | 'hired';

export interface JobApplication {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  company_id: string;
  job_id: string;
  job_title: string;
  company_name: string;
  apply_url: string;
  location: string;
  type: string;
  status: ApplicationStatus;
  candidate_email_opt_in: boolean;
  company_email_opt_in: boolean;
  recruiter_notes: string;
  interview_at: string | null;
  withdrawn_by_candidate: boolean;
  created_at: string;
  updated_at: string;
}

const ARCHIVED_APPLICATION_STATUSES: ApplicationStatus[] = ['withdrawn', 'rejected'];

function sanitizeCandidateName(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) return 'Candidate';
  const withoutLeadingNoise = compact.replace(/^[^A-Za-z]+/, '').trim();
  const withoutDigits = withoutLeadingNoise.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  return withoutDigits || 'Candidate';
}

function toIso(value: unknown): string {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function mapApplication(docId: string, data: Record<string, unknown>): JobApplication {
  return {
    id: docId,
    candidate_id: (data.candidate_id as string) || '',
    candidate_name: sanitizeCandidateName((data.candidate_name as string) || 'Candidate'),
    candidate_email: (data.candidate_email as string) || '',
    company_id: (data.company_id as string) || '',
    job_id: (data.job_id as string) || '',
    job_title: (data.job_title as string) || '',
    company_name: (data.company_name as string) || '',
    apply_url: (data.apply_url as string) || '',
    location: (data.location as string) || '',
    type: (data.type as string) || '',
    status: ((data.status as ApplicationStatus) || 'submitted'),
    candidate_email_opt_in: Boolean(data.candidate_email_opt_in),
    company_email_opt_in: Boolean(data.company_email_opt_in),
    recruiter_notes: (data.recruiter_notes as string) || '',
    interview_at: data.interview_at ? toIso(data.interview_at) : null,
    withdrawn_by_candidate: Boolean(data.withdrawn_by_candidate),
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
  };
}

export async function hasCandidateApplied(candidateId: string, jobId: string): Promise<boolean> {
  if (!candidateId || !jobId) return false;
  try {
    const snapshot = await getDocs(
      query(
        collection(db, APPLICATIONS_COLLECTION),
        where('candidate_id', '==', candidateId),
        where('job_id', '==', jobId)
      )
    );
    const rows = snapshot.docs.map((item) => item.data() as Record<string, unknown>);
    return rows.some((row) => !ARCHIVED_APPLICATION_STATUSES.includes((row.status as ApplicationStatus) || 'submitted'));
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as { message?: string }).message === 'string' &&
      (error as { message: string }).message.includes('Missing or insufficient permissions')
    ) {
      return false;
    }
    logError('applications.hasApplied.error', error, { candidateId, jobId });
    return false;
  }
}

export function canReapply(application: JobApplication): boolean {
  return ARCHIVED_APPLICATION_STATUSES.includes(application.status);
}

export async function applyToJob(input: {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  companyId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  applyUrl: string;
  location?: string;
  type?: string;
}): Promise<void> {
  const appId = `${input.candidateId}_${input.jobId}`;

  try {
    const candidateRawSettings = await getRawAccountSettingsByUserId(input.candidateId);
    const candidateSettings = normalizeCandidateSettings(candidateRawSettings || undefined);

    const candidateEmailOptIn = canSendCandidateEmail(candidateSettings, 'application_update');
    // Recruiter account settings are not candidate-readable under current rules.
    const companyEmailOptIn = true;

    const basePayload = {
      candidate_id: input.candidateId,
      candidate_name: sanitizeCandidateName(input.candidateName),
      candidate_email: input.candidateEmail,
      company_id: input.companyId,
      job_id: input.jobId,
      job_title: input.jobTitle,
      company_name: input.companyName,
      apply_url: input.applyUrl || '',
      location: input.location || '',
      type: input.type || '',
      status: 'submitted',
      candidate_email_opt_in: candidateEmailOptIn,
      company_email_opt_in: companyEmailOptIn,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(collection(db, APPLICATIONS_COLLECTION), {
        ...basePayload,
        recruiter_notes: '',
        interview_at: null,
        withdrawn_by_candidate: false,
      });
      await logAudit({
        actor_id: input.candidateId,
        actor_role: 'candidate',
        action: 'application.submitted',
        target_type: 'job',
        target_id: input.jobId,
        metadata: { application_id: docRef.id, company_id: input.companyId },
      });
    } catch (firstError) {
      const firstMessage =
        firstError && typeof firstError === 'object' && 'message' in firstError
          ? String((firstError as { message?: unknown }).message || '')
          : '';

      // Backward compatibility: old deployed rules may reject new fields.
      if (firstMessage.includes('Missing or insufficient permissions')) {
        const docRef = await addDoc(collection(db, APPLICATIONS_COLLECTION), basePayload);
        await logAudit({
          actor_id: input.candidateId,
          actor_role: 'candidate',
          action: 'application.submitted',
          target_type: 'job',
          target_id: input.jobId,
          metadata: { application_id: docRef.id, company_id: input.companyId },
        });
      } else {
        throw firstError;
      }
    }
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message || '')
        : '';
    if (message.includes('Missing or insufficient permissions')) {
      try {
        const existing = await getDocs(
          query(
            collection(db, APPLICATIONS_COLLECTION),
            where('candidate_id', '==', input.candidateId),
            where('job_id', '==', input.jobId)
          )
        );
        if (!existing.empty) {
          throw new Error('ALREADY_APPLIED');
        }
      } catch {
        // ignore secondary read failures and rethrow original write error below
      }
    }
    logError('applications.apply.error', error, { appId, candidateId: input.candidateId, jobId: input.jobId });
    throw error;
  }
}

export async function getCandidateApplications(candidateId: string): Promise<JobApplication[]> {
  try {
    const snapshot = await getDocs(
      query(collection(db, APPLICATIONS_COLLECTION), where('candidate_id', '==', candidateId))
    );
    return snapshot.docs
      .map((item) => mapApplication(item.id, item.data() as Record<string, unknown>))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  } catch (error) {
    logError('applications.candidate.fetch.error', error, { candidateId });
    return [];
  }
}

export async function getCompanyApplications(companyId: string): Promise<JobApplication[]> {
  try {
    const snapshot = await getDocs(
      query(collection(db, APPLICATIONS_COLLECTION), where('company_id', '==', companyId))
    );
    return snapshot.docs
      .map((item) => mapApplication(item.id, item.data() as Record<string, unknown>))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  } catch (error) {
    logError('applications.company.fetch.error', error, { companyId });
    return [];
  }
}

export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
  actorId?: string
): Promise<void> {
  try {
    await updateDoc(doc(db, APPLICATIONS_COLLECTION, applicationId), {
      status,
      updated_at: serverTimestamp(),
    });
    await logAudit({
      actor_id: actorId || 'unknown',
      actor_role: 'company',
      action: 'application.status.updated',
      target_type: 'application',
      target_id: applicationId,
      metadata: { status },
    });
  } catch (error) {
    logError('applications.status.update.error', error, { applicationId, status });
    throw error;
  }
}

export async function withdrawApplication(
  applicationId: string,
  actorId?: string
): Promise<void> {
  try {
    await updateDoc(doc(db, APPLICATIONS_COLLECTION, applicationId), {
      status: 'withdrawn',
      withdrawn_by_candidate: true,
      updated_at: serverTimestamp(),
    });
    await logAudit({
      actor_id: actorId || 'unknown',
      actor_role: 'candidate',
      action: 'application.withdrawn',
      target_type: 'application',
      target_id: applicationId,
    });
  } catch (error) {
    logError('applications.withdraw.error', error, { applicationId });
    throw error;
  }
}

export async function reapplyToJob(application: JobApplication): Promise<void> {
  if (!canReapply(application)) {
    throw new Error('REAPPLY_NOT_ALLOWED');
  }

  await applyToJob({
    candidateId: application.candidate_id,
    candidateName: application.candidate_name,
    candidateEmail: application.candidate_email,
    companyId: application.company_id,
    jobId: application.job_id,
    jobTitle: application.job_title,
    companyName: application.company_name,
    applyUrl: application.apply_url,
    location: application.location,
    type: application.type,
  });
}

export async function updateApplicationRecruiterFields(
  applicationId: string,
  updates: { recruiter_notes?: string; interview_at?: Date | null }
): Promise<void> {
  try {
    const payload: Record<string, unknown> = { updated_at: serverTimestamp() };
    if (updates.recruiter_notes !== undefined) payload.recruiter_notes = updates.recruiter_notes;
    if (updates.interview_at !== undefined) payload.interview_at = updates.interview_at;
    await updateDoc(doc(db, APPLICATIONS_COLLECTION, applicationId), payload);
  } catch (error) {
    logError('applications.recruiterFields.update.error', error, { applicationId });
    throw error;
  }
}
