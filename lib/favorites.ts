/**
 * Favorites Management
 * Handles user job favorites in Firestore
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Job, JobInput } from '@/types/job';
import { jobInputSchema } from './validation';
import { logError, logWarn } from './logger';
import { FirebaseError } from 'firebase/app';
import { normalizeJobStatus, normalizePipelineState } from './job-workflow';
import { logAudit } from './audit';

const FAVORITES_COLLECTION = 'favorites';
const JOBS_COLLECTION = 'jobs';

type FirestoreJobDoc = Partial<JobInput> & {
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

function mapDocToJob(id: string, data: FirestoreJobDoc): Job {
  return {
    id,
    title: data.title || '',
    company_name: data.company_name || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    salary_range: data.salary_range || { min: 0, max: 0, currency: 'USD' },
    apply_url: data.apply_url || '',
    location: data.location || 'Remote',
    type: data.type || 'Full-time',
    description: data.description || '',
    postedBy: data.postedBy,
    status: normalizeJobStatus(data.status),
    pipeline_state: normalizePipelineState(data.pipeline_state),
    created_at: toIso(data.created_at || data.createdAt),
    updated_at: toIso(data.updated_at || data.updatedAt),
  };
}

/**
 * Add job to user's favorites
 */
export async function addFavorite(userId: string, jobId: string): Promise<void> {
  try {
    const docRef = doc(db, FAVORITES_COLLECTION, `${userId}_${jobId}`);
    await setDoc(docRef, {
      userId,
      jobId,
      savedAt: serverTimestamp(),
    });
  } catch (error) {
    logError('favorites.add.error', error, { userId, jobId });
    throw error;
  }
}

/**
 * Remove job from user's favorites
 */
export async function removeFavorite(userId: string, jobId: string): Promise<void> {
  try {
    const docRef = doc(db, FAVORITES_COLLECTION, `${userId}_${jobId}`);
    await deleteDoc(docRef);
  } catch (error) {
    logError('favorites.remove.error', error, { userId, jobId });
    throw error;
  }
}

/**
 * Get all favorite jobs for a user
 */
export async function getUserFavorites(userId: string): Promise<string[]> {
  try {
    const favQuery = query(
      collection(db, FAVORITES_COLLECTION),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(favQuery);
    return snapshot.docs.map((doc) => doc.data().jobId);
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'permission-denied') {
      // Keep candidate dashboard usable even when Firestore rules are not deployed correctly yet.
      logWarn('favorites.fetch.permission_denied', { userId });
      return [];
    }
    logError('favorites.fetch.error', error, { userId });
    throw error;
  }
}

/**
 * Check if job is in user's favorites
 */
export async function isFavorited(userId: string, jobId: string): Promise<boolean> {
  try {
    const favorites = await getUserFavorites(userId);
    return favorites.includes(jobId);
  } catch (error) {
    logError('favorites.check.error', error, { userId, jobId });
    return false;
  }
}

/**
 * Post new job (admin only)
 * Returns the created job object
 */
export async function postJob(userId: string, jobData: JobInput): Promise<Job> {
  try {
    const validatedJob = jobInputSchema.parse(jobData);
    const payload = {
      ...validatedJob,
      postedBy: userId,
      status: validatedJob.status || 'open',
      pipeline_state: validatedJob.pipeline_state || 'new',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };
    let docRef;
    try {
      docRef = await addDoc(collection(db, JOBS_COLLECTION), payload);
    } catch (error) {
      // Compatibility fallback for environments still running older Firestore rules
      // that don't allow status/pipeline_state keys yet.
      if (error instanceof FirebaseError && error.code === 'permission-denied') {
        const legacyPayload = {
          ...validatedJob,
          postedBy: userId,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        };
        docRef = await addDoc(collection(db, JOBS_COLLECTION), legacyPayload);
      } else {
        throw error;
      }
    }

    await logAudit({
      actor_id: userId,
      actor_role: 'company',
      action: 'job.posted',
      target_type: 'job',
      target_id: docRef.id,
      metadata: { title: validatedJob.title },
    });

    return {
      ...validatedJob,
      id: docRef.id,
      postedBy: userId,
      status: validatedJob.status || 'open',
      pipeline_state: validatedJob.pipeline_state || 'new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } catch (error) {
    logError('jobs.post.error', error, { userId });
    throw error;
  }
}

/**
 * Get jobs posted by specific user
 */
export async function getUserPostedJobs(userId: string): Promise<Job[]> {
  try {
    const jobsQuery = query(
      collection(db, JOBS_COLLECTION),
      where('postedBy', '==', userId)
    );
    const snapshot = await getDocs(jobsQuery);
    return snapshot.docs.map((jobDoc) => mapDocToJob(jobDoc.id, jobDoc.data() as FirestoreJobDoc));
  } catch (error) {
    logError('jobs.user.fetch.error', error, { userId });
    throw error;
  }
}
