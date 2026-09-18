/**
 * Login Component
 * User authentication form
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Eye, EyeOff, Mail, Lock, Loader, ShieldCheck } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { FirebaseError } from 'firebase/app';
import { Toast, type ToastMessage } from '@/components/Toast';
import { getAuth, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { isCandidateProfileComplete } from '@/lib/candidate-profile';
import app, { hasRequiredConfig } from '@/lib/firebase';
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
  const [resetEmail, setResetEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingAction, setLoadingAction] = useState<'login' | 'reset' | 'verification' | null>(null);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showVerificationActions, setShowVerificationActions] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const { signIn, signOut, error, clearError } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLoading = loadingAction !== null;

  const clearDisplayedErrors = () => {
    setFormError('');
    clearError();
  };

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
    clearDisplayedErrors();

    if (!email || !password) {
      showLoginError('Enter your email and password first, then resend the verification email.');
      return;
    }

    setLoadingAction('verification');
    try {
      const credential = await signIn(email, password);
      if (credential.user.emailVerified) {
        setShowVerificationActions(false);
        await signOut();
        setToast({
          id: Date.now(),
          type: 'success',
          message: 'This email is already verified. You can login now.',
        });
        return;
      }

      await sendEmailVerification(credential.user);
      setShowVerificationActions(false);
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
      setLoadingAction(null);
    }
  };

  const handleForgotPassword = async () => {
    clearDisplayedErrors();

    if (!resetEmail.trim()) {
      showLoginError('Enter your email first, then send the reset link.');
      return;
    }

    setLoadingAction('reset');
    try {
      if (!hasRequiredConfig || !app) {
        throw new Error('Firebase config is missing. Check your environment variables.');
      }
      const auth = getAuth(app);
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setShowPasswordReset(false);
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
      setLoadingAction(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearDisplayedErrors();
    setLoadingAction('login');

    try {
      const credential = await signIn(email, password);

      if (!credential.user.emailVerified) {
        setShowVerificationActions(true);
        await signOut();
        showLoginError('Email not verified. Please check your inbox or resend verification email.');
        return;
      }

      setShowVerificationActions(false);
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
      setLoadingAction(null);
    }
  };

  return (
    <div className="w-full max-w-md">
     <form
       onSubmit={(event) => {
         if (!showPasswordReset) {
           handleSubmit(event);
           return;
         }
         event.preventDefault();
         void handleForgotPassword();
       }}
       className="auth-card p-8 md:p-9 lg:p-10 space-y-6"
     >
       <div className="space-y-3">
         <div className="inline-flex items-center gap-2 rounded-full border border-glass-border/70 bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-electric-blue/90">
            <ShieldCheck className="w-3.5 h-3.5" />
            Secure Access
          </div>
         <div className="space-y-2">
           <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
           {subtitle && <p className="text-sm leading-6 text-foreground-muted">{subtitle}</p>}
         </div>
       </div>

       {((formError || error) && !showVerificationActions) && (
         <div className="rounded-2xl border border-red-400/50 bg-red-500/12 p-3 text-sm text-red-700">
           {formError || error}
         </div>
       )}

       {showPasswordReset ? (
         <div className="space-y-4">
           <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-light">
             Reset Email
           </label>
           <div className="flex items-center gap-3 auth-input px-3 py-3">
             <Mail className="w-4 h-4 text-foreground-muted" />
             <input
               type="email"
               name="reset-email"
               autoComplete="email"
               value={resetEmail}
               onChange={(e) => {
                 setResetEmail(e.target.value);
                 clearDisplayedErrors();
               }}
               placeholder="your@email.com"
               className="bg-transparent outline-none w-full text-foreground placeholder-foreground-muted text-[15px] leading-6"
               required
             />
           </div>
           <button
             type="submit"
             disabled={isLoading}
             className="btn-secondary w-full flex items-center justify-center gap-2"
           >
             {loadingAction === 'reset' ? (
               <>
                 <Loader className="w-4 h-4 animate-spin" />
                 Sending reset link...
               </>
             ) : (
               'Send reset link'
             )}
           </button>
         </div>
       ) : (
         <>
           <div className="space-y-2">
             <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-light">Email</label>
             <div className="flex items-center gap-3 auth-input px-3 py-3">
               <Mail className="w-4 h-4 text-foreground-muted" />
               <input
                 type="email"
                 name="email"
                 autoComplete="email"
                 value={email}
                 onChange={(e) => {
                   setEmail(e.target.value);
                   clearDisplayedErrors();
                 }}
                 placeholder="your@email.com"
                 className="bg-transparent outline-none w-full text-foreground placeholder-foreground-muted text-[15px] leading-6"
                 required
                 onFocus={() => {
                   clearDisplayedErrors();
                   setShowVerificationActions(false);
                 }}
               />
             </div>
           </div>

           <div className="space-y-2">
             <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-light">Password</label>
             <div className="flex items-center gap-3 auth-input px-3 py-3">
               <Lock className="w-4 h-4 text-foreground-muted" />
               <input
                 type={showPassword ? 'text' : 'password'}
                 name="password"
                 autoComplete="current-password"
                 value={password}
                 onChange={(e) => {
                   setPassword(e.target.value);
                   clearDisplayedErrors();
                 }}
                 placeholder="••••••••"
                 className="bg-transparent outline-none w-full text-foreground placeholder-foreground-muted text-[15px] leading-6"
                 required
                 onFocus={() => {
                   clearDisplayedErrors();
                   setShowVerificationActions(false);
                 }}
               />
               <button
                 type="button"
                 onClick={() => setShowPassword((current) => !current)}
                 className="rounded-full p-2 text-foreground-muted transition hover:bg-slate-100 hover:text-electric-blue"
                 aria-label={showPassword ? 'Hide password' : 'Show password'}
               >
                 {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
               </button>
             </div>
             <button
               type="button"
               onClick={() => {
                 setResetEmail(email);
                 setShowPasswordReset(true);
                 clearDisplayedErrors();
               }}
               disabled={isLoading}
               className="text-sm font-semibold text-cyber-purple transition hover:text-electric-blue"
             >
               Forgot password?
             </button>
           </div>

           <button
             type="submit"
             disabled={isLoading}
             className="btn-primary w-full flex items-center justify-center gap-2 py-3"
           >
             {isLoading ? (
               <>
                 <Loader className="w-4 h-4 animate-spin" />
                 {loadingAction === 'login' ? 'Logging in...' : 'Please wait...'}
               </>
             ) : (
               'Login'
             )}
           </button>

           {showVerificationActions && (
             <div className="space-y-3 rounded-2xl border border-glass-border/70 bg-white/70 p-3">
               <p className="text-sm leading-6 text-foreground-muted">
                 {formError || error || 'Email not verified. Please check your inbox or resend verification email.'}
               </p>
               <button
                 type="button"
                 onClick={handleResendVerification}
                 disabled={isLoading}
                 className="btn-secondary w-full flex items-center justify-center gap-2"
               >
                 {loadingAction === 'verification' ? (
                   <>
                     <Loader className="w-4 h-4 animate-spin" />
                     Sending verification...
                   </>
                 ) : (
                   'Resend Verification Email'
                 )}
               </button>
             </div>
           )}

           <p className="text-center text-sm text-foreground-muted">
             Don&apos;t have an account?{' '}
             <Link href={signupPath} className="font-semibold text-cyber-purple transition hover:text-electric-blue">
               Sign up
             </Link>
           </p>
         </>
       )}
     </form>
      <div className="fixed right-4 top-4 z-50 w-[min(92vw,360px)]">
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    </div>
  );
}
