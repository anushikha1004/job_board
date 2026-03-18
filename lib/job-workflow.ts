import type { Job } from '@/types/job';

export const JOB_STATUSES = ['open', 'archived'] as const;
export const PIPELINE_STATES = [
  'new',
  'reviewed',
  'shortlisted',
  'interviewing',
  'offer',
  'hired',
  'rejected',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
export type PipelineState = (typeof PIPELINE_STATES)[number];

export const PIPELINE_LABELS: Record<PipelineState, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  shortlisted: 'Shortlisted',
  interviewing: 'Interviewing',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
};

export function normalizeJobStatus(value: unknown): JobStatus {
  if (typeof value === 'string' && (JOB_STATUSES as readonly string[]).includes(value)) {
    return value as JobStatus;
  }
  return 'open';
}

export function normalizePipelineState(value: unknown): PipelineState {
  if (typeof value === 'string' && (PIPELINE_STATES as readonly string[]).includes(value)) {
    return value as PipelineState;
  }
  return 'new';
}

export function isJobOpen(job: Job): boolean {
  return normalizeJobStatus(job.status) === 'open';
}

