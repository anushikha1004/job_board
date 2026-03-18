import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './logger';

export type CandidateAccountSettings = {
  email_notifications: boolean;
  job_alerts: boolean;
  marketing_emails: boolean;
  profile_visibility: 'public' | 'private';
};

export type CompanyAccountSettings = {
  email_notifications: boolean;
  applicant_updates: boolean;
  weekly_summary: boolean;
  profile_visibility: 'public' | 'private';
};

export const DEFAULT_CANDIDATE_SETTINGS: CandidateAccountSettings = {
  email_notifications: true,
  job_alerts: true,
  marketing_emails: false,
  profile_visibility: 'public',
};

export const DEFAULT_COMPANY_SETTINGS: CompanyAccountSettings = {
  email_notifications: true,
  applicant_updates: true,
  weekly_summary: true,
  profile_visibility: 'public',
};

export function normalizeCandidateSettings(
  raw: Partial<CandidateAccountSettings> | undefined
): CandidateAccountSettings {
  return {
    email_notifications: raw?.email_notifications ?? DEFAULT_CANDIDATE_SETTINGS.email_notifications,
    job_alerts: raw?.job_alerts ?? DEFAULT_CANDIDATE_SETTINGS.job_alerts,
    marketing_emails: raw?.marketing_emails ?? DEFAULT_CANDIDATE_SETTINGS.marketing_emails,
    profile_visibility: raw?.profile_visibility === 'private' ? 'private' : 'public',
  };
}

export function normalizeCompanySettings(
  raw: Partial<CompanyAccountSettings> | undefined
): CompanyAccountSettings {
  return {
    email_notifications: raw?.email_notifications ?? DEFAULT_COMPANY_SETTINGS.email_notifications,
    applicant_updates: raw?.applicant_updates ?? DEFAULT_COMPANY_SETTINGS.applicant_updates,
    weekly_summary: raw?.weekly_summary ?? DEFAULT_COMPANY_SETTINGS.weekly_summary,
    profile_visibility: raw?.profile_visibility === 'private' ? 'private' : 'public',
  };
}

export function canSendCandidateEmail(
  settings: CandidateAccountSettings,
  category: 'application_update' | 'job_alert' | 'marketing'
): boolean {
  if (!settings.email_notifications) return false;
  if (category === 'job_alert') return settings.job_alerts;
  if (category === 'marketing') return settings.marketing_emails;
  return true;
}

export function canSendCompanyEmail(
  settings: CompanyAccountSettings,
  category: 'applicant_update' | 'weekly_summary' | 'platform'
): boolean {
  if (!settings.email_notifications) return false;
  if (category === 'applicant_update') return settings.applicant_updates;
  if (category === 'weekly_summary') return settings.weekly_summary;
  return true;
}

export async function getRawAccountSettingsByUserId(
  userId: string
): Promise<Partial<CandidateAccountSettings & CompanyAccountSettings> | null> {
  try {
    const snapshot = await getDoc(doc(db, 'user_profiles', userId));
    if (!snapshot.exists()) return null;
    return (snapshot.data()?.account_settings || null) as Partial<
      CandidateAccountSettings & CompanyAccountSettings
    > | null;
  } catch (error) {
    logError('accountSettings.fetch.error', error, { userId });
    return null;
  }
}
