import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './logger';

const AUDIT_COLLECTION = 'audit_logs';

export type AuditAction =
  | 'job.posted'
  | 'job.updated'
  | 'job.archived'
  | 'job.reopened'
  | 'job.deleted'
  | 'application.submitted'
  | 'application.withdrawn'
  | 'application.status.updated'
  | 'admin.login';

export async function logAudit(input: {
  actor_id: string;
  actor_role: 'candidate' | 'company' | 'admin';
  action: AuditAction;
  target_type: 'job' | 'application' | 'user' | 'resume';
  target_id: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await addDoc(collection(db, AUDIT_COLLECTION), {
      ...input,
      metadata: input.metadata || {},
      created_at: serverTimestamp(),
    });
  } catch (error) {
    logError('audit.create.error', error, { action: input.action, target_id: input.target_id });
  }
}
