'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoginForm } from '@/components/LoginForm';
import { Header } from '@/components/Layout';

export default function CandidateLoginPage() {
  const { isSignedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn && !isLoading) {
      router.replace('/candidate');
    }
  }, [isSignedIn, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="auth-shell">
        <div className="container mx-auto px-6 py-16 max-w-6xl min-h-[78vh] flex items-center justify-center">
          <LoginForm
            expectedRole="candidate"
            title="Candidate Login"
            subtitle="Sign in to browse, save, and apply to tech jobs."
            signupPath="/signup/candidate"
          />
        </div>
      </main>
    </div>
  );
}
