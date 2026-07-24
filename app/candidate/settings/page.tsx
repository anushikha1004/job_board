'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Bell, KeyRound, Lock, Save, Settings, Shield, UserRound } from 'lucide-react';
import {
  deleteUser,
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  updatePassword,
} from 'firebase/auth';
import { Header } from '@/components/Layout';
import { Toast, type ToastMessage } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import app, { hasRequiredConfig } from '@/lib/firebase';
import { DEFAULT_CANDIDATE_SETTINGS, normalizeCandidateSettings, type CandidateAccountSettings } from '@/lib/account-settings';

export default function CandidateSettingsPage() {
  const { user, isLoading, isSignedIn, signOut } = useAuth();
  const router = useRouter();
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [settings, setSettings] = useState<CandidateAccountSettings>(DEFAULT_CANDIDATE_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (!isLoading && !isSignedIn) {
      router.replace('/login/candidate');
    }
  }, [isLoading, isSignedIn, router]);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;
      try {
        const profileRef = doc(db, 'user_profiles', user.uid);
        const snap = await getDoc(profileRef);
        const role = snap.data()?.role;
        if (role === 'admin') {
          router.replace('/admin');
          return;
        }
        if (role === 'company') {
          router.replace('/company/settings');
          return;
        }

        const stored = snap.data()?.account_settings as Partial<CandidateAccountSettings> | undefined;
        setSettings(normalizeCandidateSettings(stored));
      } catch (err) {
        console.error('Candidate settings load error:', err);
        setToast({ id: Date.now(), type: 'error', message: 'Failed to load account settings.' });
      } finally {
        setIsRoleLoading(false);
      }
    };

    if (!isLoading && isSignedIn && user) {
      loadSettings();
    } else if (!isLoading) {
      setIsRoleLoading(false);
    }
  }, [isLoading, isSignedIn, user, router]);

  const saveSettings = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await setDoc(
        doc(db, 'user_profiles', user.uid),
        {
          role: 'candidate',
          account_settings: settings,
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );
      setToast({ id: Date.now(), type: 'success', message: 'Account settings saved.' });
    } catch (err) {
      console.error('Candidate settings save error:', err);
      setToast({ id: Date.now(), type: 'error', message: 'Failed to save account settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    if (securityForm.newPassword.length < 6) {
      setToast({ id: Date.now(), type: 'error', message: 'New password must be at least 6 characters.' });
      return;
    }
    if (securityForm.newPassword !== securityForm.confirmNewPassword) {
      setToast({ id: Date.now(), type: 'error', message: 'New passwords do not match.' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      if (!hasRequiredConfig || !app) {
        throw new Error('Firebase is not configured.');
      }
      const auth = getAuth(app);
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) throw new Error('Not authenticated');

      const credential = EmailAuthProvider.credential(currentUser.email, securityForm.currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, securityForm.newPassword);
      setSecurityForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      setToast({ id: Date.now(), type: 'success', message: 'Password updated successfully.' });
    } catch (err) {
      console.error('Change password error:', err);
      setToast({ id: Date.now(), type: 'error', message: 'Failed to change password. Check your current password.' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      if (!hasRequiredConfig || !app) {
        throw new Error('Firebase is not configured.');
      }
      const auth = getAuth(app);
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');
      await deleteUser(currentUser);
      await signOut();
      router.push('/');
    } catch (err) {
      console.error('Delete account error:', err);
      setToast({
        id: Date.now(),
        type: 'error',
        message: 'Delete failed. Please re-login recently and try again.',
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const sendReset = async () => {
    if (!user?.email) return;
    try {
      if (!hasRequiredConfig || !app) {
        throw new Error('Firebase is not configured.');
      }
      await sendPasswordResetEmail(getAuth(app), user.email);
      setToast({ id: Date.now(), type: 'success', message: 'Password reset email sent.' });
    } catch (err) {
      console.error('Password reset error:', err);
      setToast({ id: Date.now(), type: 'error', message: 'Unable to send password reset email.' });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (err) {
      console.error('Logout error:', err);
      setToast({ id: Date.now(), type: 'error', message: 'Logout failed.' });
    }
  };

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
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyber-purple to-electric-blue text-xl font-extrabold tracking-wide text-white">
                  {(user.email?.[0] || 'C').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-foreground break-words">{user.email?.split('@')[0]}</h2>
                  <p className="mt-1 truncate text-sm text-foreground-light" title={user.email || ''}>{user.email}</p>
                </div>
              </div>

              <nav className="mt-5 space-y-2 border-t border-glass-border pt-4">
                <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <Bell className="h-4 w-4" />
                  Discover Jobs
                </Link>
                <Link href="/candidate/profile" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <UserRound className="h-4 w-4" />
                  My Profile
                </Link>
                <div className="flex items-center gap-3 rounded-xl bg-background-secondary/80 px-3 py-2 text-sm font-bold text-foreground">
                  <Settings className="h-4 w-4" />
                  Account Settings
                </div>
              </nav>
            </section>
          </aside>

          <div className="space-y-6">
            <section className="glass rounded-2xl p-7 md:p-8">
              <h1 className="text-3xl font-bold text-foreground">Account Settings</h1>
              <p className="mt-2 text-foreground-muted">Manage notifications, privacy, and security for your candidate account.</p>
            </section>

            <section className="glass rounded-2xl p-7 md:p-8">
              <h2 className="mb-5 text-xl font-bold text-foreground">Preferences</h2>
              <div className="space-y-4">
                <label className="flex items-center justify-between rounded-xl border border-glass-border px-4 py-3">
                  <span className="text-sm font-semibold text-foreground">Email Notifications</span>
                  <input
                    type="checkbox"
                    checked={settings.email_notifications}
                    onChange={(e) => setSettings((prev) => ({ ...prev, email_notifications: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-glass-border px-4 py-3">
                  <span className="text-sm font-semibold text-foreground">Job Alerts</span>
                  <input
                    type="checkbox"
                    checked={settings.job_alerts}
                    onChange={(e) => setSettings((prev) => ({ ...prev, job_alerts: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-glass-border px-4 py-3">
                  <span className="text-sm font-semibold text-foreground">Marketing Emails</span>
                  <input
                    type="checkbox"
                    checked={settings.marketing_emails}
                    onChange={(e) => setSettings((prev) => ({ ...prev, marketing_emails: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
                <div className="rounded-xl border border-glass-border px-4 py-3">
                  <label className="mb-2 block text-sm font-semibold text-foreground">Profile Visibility</label>
                  <select
                    value={settings.profile_visibility}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, profile_visibility: e.target.value === 'private' ? 'private' : 'public' }))
                    }
                    className="glass-input w-full rounded-xl px-4 py-2.5"
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={saveSettings}
                disabled={isSaving}
                className="btn-primary mt-5 inline-flex items-center gap-2 px-5 py-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </section>

            <section className="glass rounded-2xl p-7 md:p-8">
              <h2 className="mb-5 text-xl font-bold text-foreground">Security</h2>
              <div className="mb-5 rounded-xl border border-glass-border p-4 text-sm text-foreground-light">
                <p><span className="font-semibold text-foreground">Account created:</span> {user.metadata.creationTime || 'N/A'}</p>
                <p className="mt-1"><span className="font-semibold text-foreground">Last sign in:</span> {user.metadata.lastSignInTime || 'N/A'}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 mb-4">
                <input
                  type="password"
                  value={securityForm.currentPassword}
                  onChange={(e) => setSecurityForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder="Current password"
                  className="glass-input rounded-xl px-4 py-2.5"
                />
                <input
                  type="password"
                  value={securityForm.newPassword}
                  onChange={(e) => setSecurityForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="New password"
                  className="glass-input rounded-xl px-4 py-2.5"
                />
                <input
                  type="password"
                  value={securityForm.confirmNewPassword}
                  onChange={(e) => setSecurityForm((prev) => ({ ...prev, confirmNewPassword: e.target.value }))}
                  placeholder="Confirm new password"
                  className="glass-input rounded-xl px-4 py-2.5"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={sendReset} className="btn-secondary inline-flex items-center gap-2 px-4 py-2">
                  <Lock className="h-4 w-4" />
                  Reset Password
                </button>
                <button type="button" onClick={handleChangePassword} disabled={isUpdatingPassword} className="btn-secondary inline-flex items-center gap-2 px-4 py-2">
                  <KeyRound className="h-4 w-4" />
                  {isUpdatingPassword ? 'Updating...' : 'Change Password'}
                </button>
                <button type="button" onClick={handleLogout} className="btn-secondary inline-flex items-center gap-2 px-4 py-2">
                  <Shield className="h-4 w-4" />
                  Logout
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-2 text-red-300"
                >
                  Delete Account
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
      <ConfirmModal
        open={isDeleteModalOpen}
        title="Delete Candidate Account"
        description="This permanently deletes your authentication account. Continue?"
        confirmLabel={isDeletingAccount ? 'Deleting...' : 'Delete'}
        onCancel={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          setIsDeleteModalOpen(false);
          handleDeleteAccount();
        }}
      />
    </div>
  );
}
