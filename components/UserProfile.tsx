/**
 * User Profile Component
 * Shows user info and favorites
 */

'use client';

import { useAuth } from '@/lib/auth-context';

export function UserProfile() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="flex items-center gap-4">
      <div className="text-right">
        <p className="text-foreground font-medium">{user.email}</p>
        <div className="flex items-center justify-end gap-2">
          <p className="text-foreground-muted text-sm">ID: {user.uid.slice(0, 8)}</p>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              user.emailVerified
                ? 'border-neon-green/40 bg-neon-green/10 text-neon-green'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-600'
            }`}
          >
            {user.emailVerified ? 'Verified' : 'Unverified'}
          </span>
        </div>
      </div>

      <div className="w-10 h-10 rounded-full glass flex items-center justify-center">
        <span className="text-cyber-purple font-bold">
          {user.email?.[0].toUpperCase()}
        </span>
      </div>
    </div>
  );
}
