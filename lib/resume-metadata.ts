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

const COLLECTION = 'candidate_resumes';

export interface CandidateResumeRecord {
  id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  resume_path: string;
  resume_url: string;
  expires_at: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
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

function mapRecord(docId: string, data: Record<string, unknown>): CandidateResumeRecord {
  return {
    id: docId,
    user_id: (data.user_id as string) || '',
    file_name: (data.file_name as string) || '',
    file_size: Number(data.file_size) || 0,
    file_type: (data.file_type as string) || '',
    resume_path: (data.resume_path as string) || '',
    resume_url: (data.resume_url as string) || '',
    expires_at: toIso(data.expires_at),
    is_deleted: Boolean(data.is_deleted),
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
  };
}

export async function getCandidateResumeHistory(userId: string): Promise<CandidateResumeRecord[]> {
  if (!userId) return [];
  try {
    const snapshot = await getDocs(
      query(collection(db, COLLECTION), where('user_id', '==', userId))
    );
    return snapshot.docs
      .map((item) => mapRecord(item.id, item.data() as Record<string, unknown>))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  } catch (error) {
    logError('resume.history.fetch.error', error, { userId });
    return [];
  }
}

export async function addCandidateResumeRecord(input: {
  userId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  resumePath: string;
  resumeUrl: string;
  expiresAt: Date;
}): Promise<void> {
  try {
    await addDoc(collection(db, COLLECTION), {
      user_id: input.userId,
      file_name: input.fileName,
      file_size: input.fileSize,
      file_type: input.fileType,
      resume_path: input.resumePath,
      resume_url: input.resumeUrl,
      expires_at: input.expiresAt,
      is_deleted: false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    logError('resume.history.create.error', error, { userId: input.userId });
    throw error;
  }
}

export async function markCandidateResumeDeleted(resumeId: string): Promise<void> {
  try {
    await updateDoc(docRef(resumeId), {
      is_deleted: true,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    logError('resume.history.delete.error', error, { resumeId });
    throw error;
  }
}

export async function updateCandidateResumeSignedUrl(
  resumeId: string,
  resumeUrl: string,
  expiresAt: Date
): Promise<void> {
  try {
    await updateDoc(docRef(resumeId), {
      resume_url: resumeUrl,
      expires_at: expiresAt,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    logError('resume.history.renew.error', error, { resumeId });
    throw error;
  }
}

function docRef(resumeId: string) {
  return doc(db, COLLECTION, resumeId);
}
