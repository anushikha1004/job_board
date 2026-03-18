import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from './firebase';
import { logError } from './logger';
import type { JobApplication } from './applications';

const NOTIFICATION_READS_COLLECTION = 'notification_reads';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  created_at: string;
  status?: JobApplication['status'];
}

function emitNotificationsUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('notifications-updated'));
}

function isPermissionDenied(error: unknown): boolean {
  if (error instanceof FirebaseError) {
    return error.code === 'permission-denied';
  }
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return String((error as { message: string }).message).includes('Missing or insufficient permissions');
  }
  return false;
}

export function buildCandidateNotifications(applications: JobApplication[]): AppNotification[] {
  return applications.map((application) => ({
    id: application.id,
    title: `Application ${application.status}`,
    body: `${application.job_title} at ${application.company_name}`,
    created_at: application.updated_at || application.created_at,
    status: application.status,
  }));
}

export function buildCompanyNotifications(applications: JobApplication[]): AppNotification[] {
  return applications.map((application) => ({
    id: application.id,
    title: `New applicant: ${application.candidate_name}`,
    body: `${application.job_title} • ${application.candidate_email}`,
    created_at: application.created_at,
    status: application.status,
  }));
}

export async function getReadNotificationIds(userId: string): Promise<Set<string>> {
  try {
    const snapshot = await getDocs(
      query(collection(db, NOTIFICATION_READS_COLLECTION), where('user_id', '==', userId))
    );
    return new Set(
      snapshot.docs
        .map((item) => (item.data()?.notification_id as string | undefined) || '')
        .filter(Boolean)
    );
  } catch (error) {
    if (isPermissionDenied(error)) {
      // Compatibility fallback: rules for notification_reads may not be deployed yet.
      return new Set<string>();
    }
    logError('notifications.readIds.fetch.error', error, { userId });
    return new Set<string>();
  }
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  try {
    const readId = `${userId}_${notificationId}`;
    await setDoc(
      doc(db, NOTIFICATION_READS_COLLECTION, readId),
      {
        user_id: userId,
        notification_id: notificationId,
        created_at: serverTimestamp(),
        read_at: serverTimestamp(),
      },
      { merge: true }
    );
    emitNotificationsUpdated();
  } catch (error) {
    if (isPermissionDenied(error)) {
      return;
    }
    logError('notifications.read.mark.error', error, { userId, notificationId });
    throw error;
  }
}

export async function markAllNotificationsRead(
  userId: string,
  notificationIds: string[]
): Promise<void> {
  await Promise.all(notificationIds.map((notificationId) => markNotificationRead(userId, notificationId)));
  emitNotificationsUpdated();
}
