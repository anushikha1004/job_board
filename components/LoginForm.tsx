/**
 * Login Component
 * User authentication form
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Mail, Lock, Loader, ShieldCheck } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { FirebaseError } from 'firebase/app';
import { Toast, type ToastMessage } from '@/components/Toast';
import { getAuth, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { isCandidateProfileComplete } from '@/lib/candidate-profile';
import app from '@/lib/firebase';
import { setRoleCookie } from '@/lib/role-cookie';

interface LoginFormProps {
  expectedRole?: 'candidate' | 'company';
  title?: string;
  subtitle?: string;
  signupPath?: string;
}

export function LoginForm({
  expectedRole,
  title = 'Login',
  subtitle,
  signupPath = '/signup/candidate',
}: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const { signIn, signOut, error } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (searchParams.get('verify') !== 'sent') return;
    setToast({
      id: Date.now(),
      type: 'success',
      message: 'Verification email sent. Please verify your email, then login.',
    });
  }, [searchParams]);

  const showLoginError = (message: string, showSignupAction = false) => {
    setFormError(message);
    setToast({
      id: Date.now(),
      type: 'error',
      message,
      action: showSignupAction
        ? {
            label: 'Create account',
            onClick: () => router.push(signupPath),
          }
        : undefined,
    });
  };

  const getLoginErrorMessage = (err: unknown) => {
    if (err instanceof FirebaseError) {
      switch (err.code) {
        case 'auth/user-not-found':
          return { message: 'Account not found. Please sign up first.', suggestSignup: true };
        case 'auth/wrong-password':
          return { message: 'Incorrect password. Please try again.', suggestSignup: false };
        case 'auth/invalid-credential':
          return { message: 'Invalid email or password. If you are new, please sign up.', suggestSignup: true };
        case 'auth/invalid-email':
          return { message: 'Invalid email format. Please enter a valid email.', suggestSignup: false };
        case 'auth/too-many-requests':
          return { message: 'Too many attempts. Try again in a few minutes.', suggestSignup: false };
        case 'auth/network-request-failed':
          return { message: 'Network error. Check your internet connection and retry.', suggestSignup: false };
        default:
          return { message: 'Login failed. Please try again.', suggestSignup: false };
      }
    }
    if (err instanceof Error) {
      return { message: err.message, suggestSignup: false };
    }
    return { message: 'Login failed. Please try again.', suggestSignup: false };
  };

  const handleResendVerification = async () => {
    setFormError('');

    if (!email || !password) {
      showLoginError('Enter email and password first, then click resend verification.');
      return;
    }

    setIsLoading(true);
    try {
      const credential = await signIn(email, password);
      if (credential.user.emailVerified) {
        await signOut();
        setToast({
          id: Date.now(),
          type: 'success',
          message: 'This email is already verified. You can login now.',
        });
        return;
      }

      await sendEmailVerification(credential.user);
      await signOut();
      setToast({
        id: Date.now(),
        type: 'success',
        message: 'Verification email sent. Check your inbox and spam folder.',
      });
    } catch (err) {
      console.error('Resend verification error:', err);
      const mapped = getLoginErrorMessage(err);
      showLoginError(mapped.message, mapped.suggestSignup);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setFormError('');

    if (!email.trim()) {
      showLoginError('Enter your email first, then click forgot password.');
      return;
    }

    setIsLoading(true);
    try {
      const auth = getAuth(app);
      await sendPasswordResetEmail(auth, email.trim());
      setToast({
        id: Date.now(),
        type: 'success',
        message: 'Password reset email sent. Check your inbox and spam folder.',
      });
    } catch (err) {
      console.error('Forgot password error:', err);
      const mapped = getLoginErrorMessage(err);
      showLoginError(mapped.message, mapped.suggestSignup);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsLoading(true);

    try {
      const credential = await signIn(email, password);

      if (!credential.user.emailVerified) {
        await signOut();
        showLoginError('Please verify your email before login. Use "Resend Verification Email" below if needed.');
        return;
      }

      const userProfileSnap = await getDoc(doc(db, 'user_profiles', credential.user.uid));
      const role = userProfileSnap.data()?.role as 'candidate' | 'company' | undefined;

      if (expectedRole && role && role !== expectedRole) {
        await signOut();
        showLoginError(
          expectedRole === 'candidate'
            ? 'This account is a recruiter account. Use Recruiter Login.'
            : 'This account is a candidate account. Use Candidate Login.'
        );
        return;
      }

      if (role === 'company') {
        setRoleCookie('company');
        router.push('/company');
      } else if (role === 'candidate') {
        setRoleCookie('candidate');
        if (!isCandidateProfileComplete(userProfileSnap.data() as Record<string, unknown> | undefined)) {
          router.push('/candidate/profile?onboarding=1');
          return;
        }
        router.push('/candidate');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      const mapped = getLoginErrorMessage(err);
      showLoginError(mapped.message, mapped.suggestSignup);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="auth-card p-8 md:p-9 space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-glass-border/70 px-3 py-1 text-xs uppercase tracking-[0.16em] text-electric-blue/90 mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Secure Access
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="text-sm text-foreground-muted mt-2">{subtitle}</p>}
        </div>

        {(formError || error) && (
          <div className="bg-red-500/20 border border-red-500 rounded p-3 text-red-200 text-sm">
            {formError || error}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-foreground-light text-sm font-medium">Email</label>
          <div className="flex items-center gap-2 auth-input px-3">
            <Mail className="w-4 h-4 text-foreground-muted" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="bg-transparent outline-none w-full text-foreground placeholder-foreground-muted text-sm"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-foreground-light text-sm font-medium">Password</label>
          <div className="flex items-center gap-2 auth-input px-3">
            <Lock className="w-4 h-4 text-foreground-muted" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-transparent outline-none w-full text-foreground placeholder-foreground-muted text-sm"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Logging in...
            </>
          ) : (
            'Login'
          )}
        </button>

        <button
          type="button"
          onClick={handleResendVerification}
          disabled={isLoading}
          className="btn-secondary w-full flex items-center justify-center gap-2"
        >
          Resend Verification Email
        </button>

        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={isLoading}
          className="btn-secondary w-full flex items-center justify-center gap-2"
        >
          Forgot Password
        </button>

        <p className="text-center text-foreground-muted text-sm">
          Don&apos;t have an account?{' '}
          <Link href={signupPath} className="text-cyber-purple hover:text-electric-blue transition">
            Sign up
          </Link>
        </p>
      </form>
      <div className="fixed right-4 top-4 z-50 w-[min(92vw,360px)]">
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    </div>
  );
}
