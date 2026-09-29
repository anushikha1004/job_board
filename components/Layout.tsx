'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bell, LogOut, Search } from 'lucide-react';
import { getCandidateApplications, getCompanyApplications } from '@/lib/applications';
import {
  buildCandidateNotifications,
  buildCompanyNotifications,
  getReadNotificationIds,
} from '@/lib/notifications';

export const Header: React.FC = () => {
  const { isSignedIn, user, signOut } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<'candidate' | 'company' | 'admin' | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const loadRole = async () => {
      if (!isSignedIn || !user) {
        setRole(null);
        return;
      }

      try {
        const profileSnap = await getDoc(doc(db, 'user_profiles', user.uid));
        const profileRole = profileSnap.data()?.role;
        if (profileRole === 'admin') {
          setRole('admin');
        } else {
          setRole(profileRole === 'company' ? 'company' : 'candidate');
        }
      } catch (err) {
        console.error('Header role load error:', err);
        setRole(null);
      }
    };

    loadRole();
  }, [isSignedIn, user]);

  useEffect(() => {
    const loadUnreadCount = async () => {
      if (!isSignedIn || !user || !role) {
        setUnreadCount(0);
        return;
      }

      try {
        if (role === 'admin') {
          setUnreadCount(0);
          return;
        }
        const [applications, readIds] = await Promise.all([
          role === 'company'
            ? getCompanyApplications(user.uid)
            : getCandidateApplications(user.uid),
          getReadNotificationIds(user.uid),
        ]);

        const notifications = role === 'company'
          ? buildCompanyNotifications(applications)
          : buildCandidateNotifications(applications);
        const unread = notifications.reduce((count, item) => count + (readIds.has(item.id) ? 0 : 1), 0);
        setUnreadCount(unread);
      } catch (error) {
        console.error('Header unread notifications load error:', error);
        setUnreadCount(0);
      }
    };

    loadUnreadCount();

    if (typeof window !== 'undefined') {
      const refresh = () => {
        loadUnreadCount();
      };
      window.addEventListener('notifications-updated', refresh);
      return () => {
        window.removeEventListener('notifications-updated', refresh);
      };
    }
  }, [isSignedIn, user, role]);

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (err) {
      console.error('Header logout failed:', err);
    }
  };

  return (
    <header className="glass-heavy sticky top-0 z-50 w-full border-b border-glass-border/70 bg-white/85 backdrop-blur-xl shadow-soft">
      <div className="mx-auto w-full max-w-7xl px-6 py-4 xl:px-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-background/30 shadow-none md:h-11 md:w-11">
              <Image
                src="/techhire-mark.png"
                alt="TechHire mark"
                width={44}
                height={44}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div className="flex flex-col leading-none">
              <Link href="/" className="flex flex-col">
                <span className="text-[1.25rem] font-bold tracking-[-0.05em] text-foreground md:text-[1.4rem]">
                  techhire
                </span>
                <span className="mt-1 text-[11px] font-normal tracking-[0.02em] text-foreground-muted">
                  People Behind Technology
                </span>
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {!isSignedIn ? (
              <>
                <Link
                  href="/about"
                  className="rounded-full px-3 py-2 text-sm font-medium text-foreground-muted transition hover:bg-white/80 hover:text-electric-blue"
                >
                  About
                </Link>
                <Link
                  href="/login/candidate"
                  className="btn-secondary py-2 px-4 text-sm font-semibold"
                >
                  Login
                </Link>
                <Link
                  href="/login/recruiter"
                  className="btn-primary py-2 px-4 text-sm font-semibold"
                >
                  Recruiter
                </Link>
              </>
            ) : (
              <>
                <span className="hidden text-xs font-bold uppercase tracking-[0.16em] text-foreground-light md:inline">
                  {role === 'admin' ? 'Admin' : role === 'company' ? 'Recruiter' : 'Candidate'}
                </span>
                {role === 'admin' && (
                  <Link
                    href="/admin"
                    className="rounded-full border border-glass-border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-electric-blue hover:border-electric-blue/45 transition"
                  >
                    Admin Panel
                  </Link>
                )}
                <Link
                  href="/"
                  aria-label="Search jobs"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-glass-border text-foreground-muted hover:text-electric-blue hover:border-electric-blue/40 transition"
                >
                  <Search className="h-4 w-4" />
                </Link>
                <Link
                  href={role === 'admin' ? '/admin' : role === 'company' ? '/company/notifications' : '/candidate/notifications'}
                  aria-label="Notifications"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-glass-border text-foreground-muted hover:text-electric-blue hover:border-electric-blue/40 transition"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-electric-blue px-1 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn-secondary inline-flex items-center gap-2 py-2 px-3 text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export const FilterBar: React.FC = () => {
  return (
    <div className="glass rounded-lg p-6 mb-8">
      <div className="flex flex-col gap-4 md:flex-row md:gap-4">
        <input
          type="text"
          placeholder="Search jobs..."
          className="flex-1 bg-glass-background border border-glass-border rounded-lg px-4 py-3 text-foreground placeholder-foreground-muted focus:outline-none focus:border-cyber-purple focus:ring-1 focus:ring-cyber-purple"
        />
        <select className="bg-glass-background border border-glass-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-cyber-purple">
          <option value="">All Categories</option>
          <option value="remote">Remote</option>
          <option value="onsite">On-site</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <button className="btn-secondary">Filters</button>
      </div>
    </div>
  );
};

export const FeaturedSection: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <section className="section">
      <h2 className="section-title">Featured Opportunities</h2>
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-cyber rounded-2xl blur-2xl opacity-20 -z-10" />
        {children}
      </div>
    </section>
  );
};

export const EmptyState: React.FC = () => {
  return (
    <div className="glass rounded-lg p-12 text-center">
      <p className="text-foreground-muted text-lg mb-4">
        No jobs found matching your criteria
      </p>
      <button className="btn-secondary">Clear Filters</button>
    </div>
  );
};
