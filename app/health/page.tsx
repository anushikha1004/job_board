'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Layout';
import app, { db } from '@/lib/firebase';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, limit, query } from 'firebase/firestore';

type CheckStatus = 'ok' | 'warn' | 'fail';

type HealthCheck = {
  label: string;
  status: CheckStatus;
  message: string;
};

function statusClass(status: CheckStatus): string {
  if (status === 'ok') return 'border-neon-green/40 bg-neon-green/10 text-neon-green';
  if (status === 'warn') return 'border-amber-500/40 bg-amber-500/10 text-amber-700';
  return 'border-red-500/40 bg-red-500/10 text-red-500';
}

export default function HealthPage() {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    const runChecks = async () => {
      setIsRunning(true);
      const nextChecks: HealthCheck[] = [];

      const envEntries: Array<[string, string | undefined]> = [
        ['NEXT_PUBLIC_FIREBASE_API_KEY', process.env.NEXT_PUBLIC_FIREBASE_API_KEY],
        ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN],
        ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID],
        ['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET],
        ['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID],
        ['NEXT_PUBLIC_FIREBASE_APP_ID', process.env.NEXT_PUBLIC_FIREBASE_APP_ID],
      ];
      const missingEnv = envEntries.filter(([, value]) => !value).map(([key]) => key);
      nextChecks.push({
        label: 'Environment',
        status: missingEnv.length === 0 ? 'ok' : 'warn',
        message: missingEnv.length === 0 ? 'All required NEXT_PUBLIC Firebase env vars present.' : `Missing: ${missingEnv.join(', ')}`,
      });

      try {
        getAuth(app);
        nextChecks.push({
          label: 'Firebase Auth SDK',
          status: 'ok',
          message: 'Auth SDK initialized successfully.',
        });
      } catch (err) {
        nextChecks.push({
          label: 'Firebase Auth SDK',
          status: 'fail',
          message: err instanceof Error ? err.message : 'Auth SDK initialization failed.',
        });
      }

      try {
        await getDocs(query(collection(db, 'jobs'), limit(1)));
        nextChecks.push({
          label: 'Firestore Read',
          status: 'ok',
          message: 'Firestore read query succeeded.',
        });
      } catch (err) {
        nextChecks.push({
          label: 'Firestore Read',
          status: 'fail',
          message: err instanceof Error ? err.message : 'Firestore query failed.',
        });
      }

      setChecks(nextChecks);
      setIsRunning(false);
    };

    runChecks();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-5xl px-6 py-10">
        <section className="glass rounded-xl p-7">
          <h1 className="text-2xl font-bold text-foreground">System Health Check</h1>
          <p className="mt-2 text-sm text-foreground-muted">Quick verification of Firebase environment, auth SDK, and Firestore connectivity.</p>
          <div className="mt-6 space-y-3">
            {isRunning ? (
              <p className="text-foreground-muted">Running checks...</p>
            ) : (
              checks.map((check) => (
                <div key={check.label} className={`rounded-lg border px-4 py-3 ${statusClass(check.status)}`}>
                  <p className="text-sm font-semibold">{check.label}</p>
                  <p className="mt-1 text-xs">{check.message}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
