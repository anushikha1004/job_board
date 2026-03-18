'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Bell, Briefcase, ClipboardList, MailCheck, Settings, UserRound } from 'lucide-react';
import { Header } from '@/components/Layout';
import { Toast, type ToastMessage } from '@/components/Toast';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { getCompanyApplications, type JobApplication } from '@/lib/applications';
import {
  buildCompanyNotifications,
  getReadNotificationIds,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications';
import { formatDate } from '@/lib/utils';

type ViewFilter = 'all' | 'unread' | 'read';

export default function CompanyNotificationsPage() {
  const { user, isLoading, isSignedIn } = useAuth();
  const router = useRouter();
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ViewFilter>('all');
  const [markingAll, setMarkingAll] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (!isLoading && !isSignedIn) {
      router.replace('/login/recruiter');
    }
  }, [isLoading, isSignedIn, router]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      try {
        const profileSnap = await getDoc(doc(db, 'user_profiles', user.uid));
        const role = profileSnap.data()?.role;
        if (role === 'admin') {
          router.replace('/admin');
          return;
        }
        if (role === 'candidate') {
          router.replace('/candidate/notifications');
          return;
        }

        const apps = await getCompanyApplications(user.uid);
        const reads = await getReadNotificationIds(user.uid);
        setApplications(apps);
        setReadIds(reads);
      } catch (err) {
        console.error('Company notifications load error:', err);
        setToast({ id: Date.now(), type: 'error', message: 'Failed to load notifications.' });
      } finally {
        setIsRoleLoading(false);
      }
    };

    if (!isLoading && isSignedIn && user) {
      loadData();
    } else if (!isLoading) {
      setIsRoleLoading(false);
    }
  }, [isLoading, isSignedIn, user, router]);

  const notifications = useMemo(() => buildCompanyNotifications(applications), [applications]);
  const unreadCount = useMemo(
    () => notifications.filter((item) => !readIds.has(item.id)).length,
    [notifications, readIds]
  );
  const visibleNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter((item) => !readIds.has(item.id));
    return notifications.filter((item) => readIds.has(item.id));
  }, [notifications, readIds, filter]);

  const handleMarkRead = async (notificationId: string) => {
    if (!user) return;
    if (readIds.has(notificationId)) return;
    setReadIds((prev) => new Set(prev).add(notificationId));
    try {
      await markNotificationRead(user.uid, notificationId);
      setToast({ id: Date.now(), type: 'success', message: 'Marked as read.' });
    } catch (error) {
      const rollback = new Set(readIds);
      rollback.delete(notificationId);
      setReadIds(rollback);
      console.error('Mark notification read failed:', error);
      setToast({ id: Date.now(), type: 'error', message: 'Could not mark as read.' });
    } finally {
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    const pending = notifications.filter((item) => !readIds.has(item.id)).map((item) => item.id);
    if (pending.length === 0) return;

    setMarkingAll(true);
    const optimistic = new Set(readIds);
    pending.forEach((id) => optimistic.add(id));
    setReadIds(optimistic);
    try {
      await markAllNotificationsRead(user.uid, pending);
      setToast({ id: Date.now(), type: 'success', message: 'All notifications marked as read.' });
    } catch (error) {
      setReadIds(new Set(readIds));
      console.error('Mark all notifications read failed:', error);
      setToast({ id: Date.now(), type: 'error', message: 'Could not mark all as read.' });
    } finally {
      setMarkingAll(false);
    }
  };

  if (isLoading || isRoleLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-foreground">Loading...</div></div>;
  }

  if (!user) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-foreground-muted">Redirecting...</div></div>;
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
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-cyber-purple to-electric-blue text-xl font-extrabold tracking-wide text-white">
                  {(user.email?.[0] || 'R').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-foreground wrap-break-word">{user.email?.split('@')[0]}</h2>
                  <p className="mt-1 text-sm text-foreground-muted">Unread: {unreadCount}</p>
                </div>
              </div>
              <nav className="mt-5 space-y-2 border-t border-glass-border pt-4">
                <Link href="/company" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <Briefcase className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link href="/company/applications" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <ClipboardList className="h-4 w-4" />
                  Applications
                </Link>
                <div className="flex items-center gap-3 rounded-xl bg-background-secondary/80 px-3 py-2 text-sm font-bold text-foreground">
                  <Bell className="h-4 w-4" />
                  Notifications
                </div>
                <Link href="/company/settings" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <Settings className="h-4 w-4" />
                  Account Settings
                </Link>
                <Link href="/company" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-foreground-light hover:bg-background-secondary/70">
                  <UserRound className="h-4 w-4" />
                  Company Profile
                </Link>
              </nav>
            </section>
          </aside>

          <div className="space-y-6">
            <section className="glass rounded-2xl p-7 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
                  <p className="mt-2 text-foreground-muted">Latest candidate activity for your job postings.</p>
                </div>
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAll || unreadCount === 0}
                  className="btn-secondary inline-flex items-center gap-2 py-2 px-4 disabled:opacity-60"
                >
                  <MailCheck className="h-4 w-4" />
                  Mark All Read
                </button>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {(['all', 'unread', 'read'] as ViewFilter[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={
                      item === filter
                        ? 'rounded-full bg-electric-blue px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white'
                        : 'rounded-full border border-glass-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground-light'
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              {visibleNotifications.length === 0 ? (
                <div className="glass rounded-2xl p-10 text-center">
                  <p className="text-foreground-muted">No notifications yet.</p>
                </div>
              ) : (
                visibleNotifications.map((notification) => (
                  <article
                    key={notification.id}
                    className={`glass rounded-2xl p-6 cursor-pointer transition ${readIds.has(notification.id) ? 'opacity-80' : 'ring-1 ring-electric-blue/25'}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!readIds.has(notification.id)) {
                        handleMarkRead(notification.id);
                      }
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !readIds.has(notification.id)) {
                        e.preventDefault();
                        handleMarkRead(notification.id);
                      }
                    }}
                  >
                    <h2 className="text-lg font-bold text-foreground">{notification.title}</h2>
                    <p className="mt-1 text-sm text-foreground-muted">{notification.body}</p>
                    <p className="mt-2 text-xs text-foreground-light">{formatDate(notification.created_at)}</p>
                    {!readIds.has(notification.id) && (
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-electric-blue">
                        Click to mark as read
                      </p>
                    )}
                  </article>
                ))
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
