import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Job } from '@/types/job';
import { getAllJobs, updateJob } from './firestore';
import { logError } from './logger';

const AUDIT_COLLECTION = 'audit_logs';
const USER_PROFILES_COLLECTION = 'user_profiles';
const APPLICATIONS_COLLECTION = 'applications';

export type AdminMetrics = {
  totalJobs: number;
  openJobs: number;
  totalApplications: number;
  hiredApplications: number;
  totalCandidates: number;
  totalRecruiters: number;
  totalAdmins: number;
  createdLast30Days: {
    jobs: number;
    applications: number;
    candidates: number;
    recruiters: number;
  };
};

export type AuditLogEntry = {
  id: string;
  actor_id: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

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

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const now = Date.now();
  const last30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

  try {
    const [jobsSnap, appsSnap, usersSnap] = await Promise.all([
      getDocs(query(collection(db, 'jobs'))),
      getDocs(query(collection(db, APPLICATIONS_COLLECTION))),
      getDocs(query(collection(db, USER_PROFILES_COLLECTION))),
    ]);

    const totalJobs = jobsSnap.size;
    const openJobs = jobsSnap.docs.filter((docItem) => docItem.data().status !== 'archived').length;
    const totalApplications = appsSnap.size;
    const hiredApplications = appsSnap.docs.filter((docItem) => docItem.data().status === 'hired').length;

    const users = usersSnap.docs.map((docItem) => docItem.data());
    const totalCandidates = users.filter((user) => user.role === 'candidate').length;
    const totalRecruiters = users.filter((user) => user.role === 'company').length;
    const totalAdmins = users.filter((user) => user.role === 'admin').length;

    const createdLast30Days = {
      jobs: jobsSnap.docs.filter((docItem) => {
        const createdAt = docItem.data().created_at?.toDate?.() as Date | undefined;
        return createdAt ? createdAt >= last30 : false;
      }).length,
      applications: appsSnap.docs.filter((docItem) => {
        const createdAt = docItem.data().created_at?.toDate?.() as Date | undefined;
        return createdAt ? createdAt >= last30 : false;
      }).length,
      candidates: users.filter((user) => user.role === 'candidate' && user.created_at?.toDate?.() >= last30).length,
      recruiters: users.filter((user) => user.role === 'company' && user.created_at?.toDate?.() >= last30).length,
    };

    return {
      totalJobs,
      openJobs,
      totalApplications,
      hiredApplications,
      totalCandidates,
      totalRecruiters,
      totalAdmins,
      createdLast30Days,
    };
  } catch (error) {
    logError('admin.metrics.error', error, {});
    return {
      totalJobs: 0,
      openJobs: 0,
      totalApplications: 0,
      hiredApplications: 0,
      totalCandidates: 0,
      totalRecruiters: 0,
      totalAdmins: 0,
      createdLast30Days: { jobs: 0, applications: 0, candidates: 0, recruiters: 0 },
    };
  }
}

export async function getAuditLogs(limitCount = 50): Promise<AuditLogEntry[]> {
  try {
    const logsSnap = await getDocs(
      query(collection(db, AUDIT_COLLECTION), orderBy('created_at', 'desc'), limit(limitCount))
    );
    return logsSnap.docs.map((docItem) => {
      const data = docItem.data() as Record<string, unknown>;
      return {
        id: docItem.id,
        actor_id: (data.actor_id as string) || '',
        actor_role: (data.actor_role as string) || '',
        action: (data.action as string) || '',
        target_type: (data.target_type as string) || '',
        target_id: (data.target_id as string) || '',
        metadata: (data.metadata as Record<string, unknown>) || {},
        created_at: toIso(data.created_at),
      };
    });
  } catch (error) {
    logError('admin.audit.fetch.error', error, {});
    return [];
  }
}

export async function getRecentJobs(limitCount = 8): Promise<Job[]> {
  try {
    return await getAllJobs([limit(limitCount)]);
  } catch (error) {
    logError('admin.jobs.fetch.error', error, {});
    return [];
  }
}

export async function adminSetJobStatus(jobId: string, status: 'open' | 'archived'): Promise<void> {
  await updateJob(jobId, { status });
}
