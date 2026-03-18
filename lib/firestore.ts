/**
 * Firestore Operations for Job Management
 * Handles all database queries and mutations for jobs
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  QueryConstraint,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Job, JobInput } from '@/types/job';
import type { CompanyProfile } from '@/types/company';
import { formatSalaryRange } from './utils';
import { logError } from './logger';
import { normalizeJobStatus, normalizePipelineState } from './job-workflow';

const JOBS_COLLECTION = 'jobs';
const COMPANY_PROFILES_COLLECTION = 'company_profiles';
const FIRESTORE_IN_LIMIT = 10;

type FirestoreJobDoc = Partial<Job> & {
  salary?: string;
  salary_range?: string | { min?: number; max?: number; currency?: string };
  salaryRange?: string | { min?: number; max?: number; currency?: string };
  companyName?: string;
  applyUrl?: string;
  created_at?: { toDate?: () => Date };
  updated_at?: { toDate?: () => Date };
  createdAt?: { toDate?: () => Date };
  updatedAt?: { toDate?: () => Date };
  postedBy?: string;
  status?: string;
  pipeline_state?: string;
};

function toIso(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function mapJobDoc(docId: string, data: FirestoreJobDoc): Job {
  const salaryRange = data.salary_range || data.salaryRange || { min: 0, max: 0, currency: 'USD' };
  let salary = '';

  if (typeof salaryRange === 'string') {
    salary = salaryRange;
  } else {
    salary = formatSalaryRange(salaryRange.min || 0, salaryRange.max || 0, salaryRange.currency || 'USD');
  }

  return {
    id: docId,
    title: data.title || '',
    company_name: data.company_name || data.companyName || '',
    tags: data.tags || [],
    salary_range: typeof salaryRange === 'string' ? { min: 0, max: 0, currency: 'USD' } : salaryRange,
    apply_url: data.apply_url || data.applyUrl || '',
    location: data.location,
    type: data.type,
    description: data.description || '',
    postedBy: data.postedBy,
    status: normalizeJobStatus(data.status),
    pipeline_state: normalizePipelineState(data.pipeline_state),
    salary,
    created_at: toIso(data.created_at || data.createdAt),
    updated_at: toIso(data.updated_at || data.updatedAt),
  } as Job;
}

/**
 * Get all jobs with optional filters
 */
export async function getAllJobs(
  constraints: QueryConstraint[] = []
): Promise<Job[]> {
  try {
    const baseQuery = query(
      collection(db, JOBS_COLLECTION),
      orderBy('created_at', 'desc'),
      ...constraints
    );

    const snapshot = await getDocs(baseQuery);
    return snapshot.docs.map((snapshotDoc) => mapJobDoc(snapshotDoc.id, snapshotDoc.data() as FirestoreJobDoc));
  } catch (error) {
    logError('jobs.fetch.error', error);
    throw new Error('Failed to fetch jobs from database');
  }
}

/**
 * Get jobs by company
 */
export async function getJobsByCompany(companyName: string): Promise<Job[]> {
  return getAllJobs([where('company_name', '==', companyName)]);
}

/**
 * Get jobs by tag/technology
 */
export async function getJobsByTag(tag: string): Promise<Job[]> {
  return getAllJobs([where('tags', 'array-contains', tag)]);
}

/**
 * Get jobs by location
 */
export async function getJobsByLocation(location: string): Promise<Job[]> {
  return getAllJobs([where('location', '==', location)]);
}

/**
 * Get jobs by type (Full-time, Part-time, Contract, etc.)
 */
export async function getJobsByType(jobType: string): Promise<Job[]> {
  return getAllJobs([where('type', '==', jobType)]);
}

/**
 * Get featured jobs (most recent or flagged as featured)
 */
export async function getFeaturedJobs(count: number = 3): Promise<Job[]> {
  try {
    const featuredQuery = query(
      collection(db, JOBS_COLLECTION),
      orderBy('created_at', 'desc'),
      limit(count)
    );

    const snapshot = await getDocs(featuredQuery);
    return snapshot.docs.map((snapshotDoc) => mapJobDoc(snapshotDoc.id, snapshotDoc.data() as FirestoreJobDoc)) as Job[];
  } catch (error) {
    logError('jobs.featured.fetch.error', error, { count });
    throw new Error('Failed to fetch featured jobs');
  }
}

/**
 * Get single job by ID
 */
export async function getJobById(jobId: string): Promise<Job | null> {
  try {
    const snapshot = await getDoc(doc(db, JOBS_COLLECTION, jobId));
    if (!snapshot.exists()) return null;
    return mapJobDoc(snapshot.id, snapshot.data() as FirestoreJobDoc);
  } catch (error) {
    logError('jobs.fetch.byId.error', error, { jobId });
    return null;
  }
}

/**
 * Create new job (requires authentication in production)
 */
export async function createJob(jobInput: JobInput): Promise<Job> {
  try {
    const jobData = {
      ...jobInput,
      status: jobInput.status || 'open',
      pipeline_state: jobInput.pipeline_state || 'new',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, JOBS_COLLECTION), jobData);

    return {
      id: docRef.id,
      ...jobInput,
      status: jobInput.status || 'open',
      pipeline_state: jobInput.pipeline_state || 'new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Job;
  } catch (error) {
    logError('jobs.create.error', error);
    throw new Error('Failed to create job');
  }
}

/**
 * Update existing job (requires authentication in production)
 */
export async function updateJob(jobId: string, updates: Partial<Job>): Promise<void> {
  try {
    const jobRef = doc(db, JOBS_COLLECTION, jobId);
    const existing = await getDoc(jobRef);
    if (!existing.exists()) {
      throw new Error('Job not found');
    }

    const current = existing.data() as FirestoreJobDoc;
    const nextMin = Number(
      updates.salary_range?.min ??
      (typeof current.salary_range === 'object' && current.salary_range !== null ? current.salary_range.min : 0) ??
      0
    );
    const nextMaxRaw = Number(
      updates.salary_range?.max ??
      (typeof current.salary_range === 'object' && current.salary_range !== null ? current.salary_range.max : 0) ??
      0
    );
    const nextMax = nextMaxRaw >= nextMin ? nextMaxRaw : nextMin;
    const nextCurrency =
      updates.salary_range?.currency ||
      (typeof current.salary_range === 'object' && current.salary_range !== null
        ? current.salary_range.currency
        : undefined) ||
      'USD';

    const fullPayload = {
      title: updates.title ?? current.title ?? '',
      company_name: updates.company_name ?? current.company_name ?? current.companyName ?? '',
      description: updates.description ?? current.description ?? '',
      tags: updates.tags ?? current.tags ?? [],
      location: updates.location ?? current.location ?? '',
      type: updates.type ?? current.type ?? '',
      apply_url: updates.apply_url ?? current.apply_url ?? current.applyUrl ?? '',
      salary_range: {
        min: Number.isFinite(nextMin) ? Math.trunc(nextMin) : 0,
        max: Number.isFinite(nextMax) ? Math.trunc(nextMax) : 0,
        currency: String(nextCurrency || 'USD'),
      },
      postedBy: current.postedBy || '',
      status: normalizeJobStatus((updates.status as string | undefined) || current.status),
      pipeline_state: normalizePipelineState(
        (updates.pipeline_state as string | undefined) || current.pipeline_state
      ),
      created_at: current.created_at || current.createdAt || serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    await setDoc(jobRef, fullPayload, { merge: false });
  } catch (error) {
    logError('jobs.update.error', error, { jobId });
    throw new Error('Failed to update job');
  }
}

/**
 * Delete job (requires authentication in production)
 */
export async function deleteJobById(jobId: string): Promise<void> {
  try {
    const jobRef = doc(db, JOBS_COLLECTION, jobId);
    await deleteDoc(jobRef);
  } catch (error) {
    logError('jobs.delete.error', error, { jobId });
    throw new Error('Failed to delete job');
  }
}

/**
 * Search jobs by title or company (client-side filtering)
 */
export async function searchJobs(searchTerm: string): Promise<Job[]> {
  try {
    const allJobs = await getAllJobs();
    const term = searchTerm.toLowerCase();

    return allJobs.filter(
      (job) =>
        job.title.toLowerCase().includes(term) ||
        job.company_name.toLowerCase().includes(term) ||
        job.description?.toLowerCase().includes(term)
    );
  } catch (error) {
    logError('jobs.search.error', error, { searchTerm });
    throw new Error('Failed to search jobs');
  }
}

function timestampToIso(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function mapCompanyProfile(docId: string, data: Record<string, unknown>): CompanyProfile {
  return {
    id: docId,
    userId: (data.userId as string) || docId,
    company_name: (data.company_name as string) || '',
    website: (data.website as string | undefined) || undefined,
    about: (data.about as string | undefined) || undefined,
    size: (data.size as string | undefined) || undefined,
    location: (data.location as string | undefined) || undefined,
    created_at: timestampToIso(data.created_at),
    updated_at: timestampToIso(data.updated_at),
  };
}

/**
 * Fetch a single company profile by user ID (postedBy)
 */
export async function getCompanyProfileByUserId(userId: string): Promise<CompanyProfile | null> {
  try {
    const profileQuery = query(collection(db, COMPANY_PROFILES_COLLECTION), where('userId', '==', userId), limit(1));
    const snapshot = await getDocs(profileQuery);
    const first = snapshot.docs[0];
    if (!first) return null;
    return mapCompanyProfile(first.id, first.data() as Record<string, unknown>);
  } catch (error) {
    logError('companyProfile.fetch.error', error, { userId });
    return null;
  }
}

/**
 * Create or update company profile
 */
export async function upsertCompanyProfile(
  userId: string,
  input: Pick<CompanyProfile, 'company_name'> &
    Partial<Pick<CompanyProfile, 'website' | 'about' | 'size' | 'location'>>
): Promise<void> {
  const profileRef = doc(db, COMPANY_PROFILES_COLLECTION, userId);
  const existing = await getDoc(profileRef);
  const payload: Record<string, unknown> = {
    userId,
    company_name: input.company_name,
    website: input.website || '',
    about: input.about || '',
    size: input.size || '',
    location: input.location || '',
    updated_at: serverTimestamp(),
  };

  if (existing.exists()) {
    payload.created_at = existing.data()?.created_at || serverTimestamp();
  } else {
    payload.created_at = serverTimestamp();
  }

  await setDoc(profileRef, payload, { merge: true });
}

/**
 * Fetch multiple company profiles in one call and map by userId
 */
export async function getCompanyProfilesByUserIds(userIds: string[]): Promise<Record<string, CompanyProfile>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  try {
    const chunkedIds: string[][] = [];
    for (let index = 0; index < uniqueIds.length; index += FIRESTORE_IN_LIMIT) {
      chunkedIds.push(uniqueIds.slice(index, index + FIRESTORE_IN_LIMIT));
    }

    const profileSnapshots = await Promise.all(
      chunkedIds.map((idsChunk) =>
        getDocs(
          query(
            collection(db, COMPANY_PROFILES_COLLECTION),
            where('userId', 'in', idsChunk)
          )
        )
      )
    );
    const profileMap: Record<string, CompanyProfile> = {};

    profileSnapshots.forEach((snapshot) => {
      snapshot.docs.forEach((profileDoc) => {
        const mapped = mapCompanyProfile(profileDoc.id, profileDoc.data() as Record<string, unknown>);
        profileMap[mapped.userId] = mapped;
      });
    });

    return profileMap;
  } catch (error) {
    logError('companyProfile.bulkFetch.error', error, { count: uniqueIds.length });
    return {};
  }
}

/**
 * Get similar jobs based on shared tags and type
 */
export async function getSimilarJobs(job: Job, count: number = 3): Promise<Job[]> {
  try {
    const allJobs = await getAllJobs();
    const currentTags = new Set((job.tags || []).map((tag) => tag.toLowerCase()));
    const currentLocation = (job.location || '').toLowerCase();
    const currentType = (job.type || '').toLowerCase();
    const currentSalaryMin = Number(job.salary_range?.min || 0);

    const scored = allJobs
      .filter((item) => item.id !== job.id)
      .map((item) => {
        const sharedTags = (item.tags || []).filter((tag) => currentTags.has(tag.toLowerCase())).length;
        const itemType = (item.type || '').toLowerCase();
        const itemLocation = (item.location || '').toLowerCase();
        const typeMatch = itemType && currentType && itemType === currentType ? 1 : 0;
        const locationMatch = itemLocation && currentLocation && itemLocation.includes(currentLocation) ? 1 : 0;
        const itemSalaryMin = Number(item.salary_range?.min || 0);
        const salaryGapRatio =
          currentSalaryMin > 0 && itemSalaryMin > 0
            ? Math.abs(currentSalaryMin - itemSalaryMin) / currentSalaryMin
            : 1;
        const salaryBandMatch = salaryGapRatio <= 0.25 ? 1 : 0;
        return {
          item,
          score: sharedTags * 4 + typeMatch * 2 + locationMatch + salaryBandMatch,
        };
      })
      .sort((a, b) => b.score - a.score);

    const qualityMatches = scored
      .filter((entry) => entry.score >= 3)
      .slice(0, count)
      .map((entry) => entry.item);

    if (qualityMatches.length >= count) {
      return qualityMatches;
    }

    const usedIds = new Set(qualityMatches.map((item) => item.id));
    const newestFallback = allJobs
      .filter((item) => item.id !== job.id && !usedIds.has(item.id))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, count - qualityMatches.length);

    return [...qualityMatches, ...newestFallback];
  } catch (error) {
    logError('jobs.similar.fetch.error', error, { jobId: job.id, count });
    return [];
  }
}
