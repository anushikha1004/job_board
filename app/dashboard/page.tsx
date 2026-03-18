
'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function DashboardPage() {
  const { user, isLoading, isSignedIn } = useAuth();
  const router = useRouter();
  const hasRoutedRef = useRef(false);

  const resolvePendingRole = (): 'candidate' | 'company' | null => {
    if (typeof window === 'undefined') return null;
    const pendingRole = sessionStorage.getItem('pendingRole');
    if (pendingRole === 'candidate' || pendingRole === 'company') {
      return pendingRole;
    }
    return null;
  };

  const clearPendingRole = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('pendingRole');
    }
  };

  useEffect(() => {
    if (isLoading || hasRoutedRef.current) {
      return;
    }

    if (!isSignedIn) {
      hasRoutedRef.current = true;
      router.replace('/login/candidate');
      return;
    }

    if (!user) {
      return;
    }

    hasRoutedRef.current = true;

    // Get user role from Firestore and redirect accordingly
    const getUserRole = async () => {
      try {
        const userProfileRef = doc(db, 'user_profiles', user.uid);
        const userProfileSnap = await getDoc(userProfileRef);

        if (userProfileSnap.exists()) {
          const role = userProfileSnap.data().role;
          if (role === 'admin') {
            clearPendingRole();
            router.replace('/admin');
          } else if (role === 'candidate') {
            clearPendingRole();
            router.replace('/candidate');
          } else if (role === 'company') {
            clearPendingRole();
            router.replace('/company');
          } else {
            const pendingRole = resolvePendingRole();
            clearPendingRole();
            router.replace(pendingRole === 'company' ? '/company' : '/candidate');
          }
        } else {
          const pendingRole = resolvePendingRole();
          clearPendingRole();
          router.replace(pendingRole === 'company' ? '/company' : '/candidate');
        }
      } catch (err) {
        console.error('Error fetching user role:', err);
        const pendingRole = resolvePendingRole();
        clearPendingRole();
        router.replace(pendingRole === 'company' ? '/company' : '/candidate');
      }
    };

    getUserRole();
  }, [isLoading, isSignedIn, user, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse text-foreground mb-4">Redirecting...</div>
        <p className="text-foreground-muted">Setting up your dashboard</p>
      </div>
    </div>
  );
}
