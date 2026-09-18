/**
 * Signup Component
 * New user registration form with role selection
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Eye, EyeOff, Mail, Lock, Loader, Briefcase, Search, UserPlus } from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FirebaseError } from 'firebase/app';
import { sendEmailVerification } from 'firebase/auth';
import { z } from 'zod';
import { companyProfileInputSchema, getZodErrorMessage, userProfileInputSchema } from '@/lib/validation';
import Link from 'next/link';

interface SignupFormProps {
  initialRole?: 'candidate' | 'company';
  lockRole?: boolean;
  title?: string;
  subtitle?: string;
  loginPath?: string;
}

export function SignupForm({
  initialRole,
  lockRole = false,
  title = 'Create Account',
  subtitle,
  loginPath = '/login/candidate',
}: SignupFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<'candidate' | 'company' | ''>(initialRole || '');
  const [companyName, setCompanyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const { signUp, signOut, error } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    if (!role) {
      setFormError('Please select your role.');
      return;
    }

    setIsLoading(true);

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pendingRole', role);
      }

      const userCredential = await signUp(email, password);
      const user = userCredential.user;

      userProfileInputSchema.parse({
        email: user.email,
        role,
        company_name: role === 'company' ? companyName : null,
        created_at: new Date(),
      });
      const profilePayload = {
        email: user.email,
        role,
        company_name: role === 'company' ? companyName.trim() : null,
        created_at: serverTimestamp(),
      };

      // Store user profile in Firestore
      await setDoc(doc(db, 'user_profiles', user.uid), profilePayload);

      if (role === 'company') {
        companyProfileInputSchema.parse({
          userId: user.uid,
          company_name: companyName.trim(),
          website: '',
          about: '',
          size: '',
          location: '',
          created_at: new Date(),
          updated_at: new Date(),
        });
        const companyProfilePayload = {
          userId: user.uid,
          company_name: companyName.trim(),
          website: '',
          about: '',
          size: '',
          location: '',
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        };
        await setDoc(doc(db, 'company_profiles', user.uid), companyProfilePayload);
      }

      await sendEmailVerification(user);
      await signOut();

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pendingRole');
      }

      router.replace(`${loginPath}?verify=sent`);
    } catch (err: unknown) {
      console.error('Signup error:', err);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pendingRole');
      }
      if (err instanceof FirebaseError && err.code === 'permission-denied') {
        setFormError('Permission denied in Firestore. Allow write access to user_profiles for authenticated users.');
      } else if (err instanceof z.ZodError) {
        setFormError(getZodErrorMessage(err));
      } else if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError('Signup failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="w-full max-w-md">
     <form onSubmit={handleSubmit} className="auth-card p-8 md:p-9 lg:p-10 space-y-6">
       <div className="space-y-3">
         <div className="inline-flex items-center gap-2 rounded-full border border-glass-border/70 bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-electric-blue/90">
            <UserPlus className="w-3.5 h-3.5" />
            New Account
          </div>
         <div className="space-y-2">
           <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
           {subtitle && <p className="text-sm leading-6 text-foreground-muted">{subtitle}</p>}
         </div>
       </div>

       {(formError || error) && (
         <div className="rounded-2xl border border-red-400/50 bg-red-500/12 p-3 text-sm text-red-700">
           {formError || error}
         </div>
       )}

       {!lockRole && (
         <div className="space-y-2">
           <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-light">I am a...</label>
           <div className="space-y-2">
             <label className="flex items-center gap-3 rounded-2xl border border-glass-border/70 bg-white/80 p-3 transition hover:border-electric-blue/40 hover:shadow-sm cursor-pointer">
               <input
                 type="radio"
                 name="role"
                 value="candidate"
                 checked={role === 'candidate'}
                 onChange={(e) => setRole(e.target.value as 'candidate')}
                 className="w-4 h-4"
               />
               <Search className="w-4 h-4 text-electric-blue" />
               <span className="text-foreground">Candidate</span>
             </label>
             <label className="flex items-center gap-3 rounded-2xl border border-glass-border/70 bg-white/80 p-3 transition hover:border-cyber-purple/40 hover:shadow-sm cursor-pointer">
               <input
                 type="radio"
                 name="role"
                 value="company"
                 checked={role === 'company'}
                 onChange={(e) => setRole(e.target.value as 'company')}
                 className="w-4 h-4"
               />
               <Briefcase className="w-4 h-4 text-cyber-purple" />
               <span className="text-foreground">Recruiter/Hiring</span>
             </label>
           </div>
         </div>
       )}

       <div className="space-y-2">
         <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-light">Email</label>
         <div className="flex items-center gap-3 auth-input px-3 py-3">
           <Mail className="w-4 h-4 text-foreground-muted" />
           <input
             type="email"
             name="email"
             autoComplete="email"
             value={email}
             onChange={(e) => setEmail(e.target.value)}
             placeholder="your@email.com"
             className="bg-transparent outline-none w-full text-foreground placeholder-foreground-muted text-[15px] leading-6"
             required
           />
         </div>
       </div>

       {role === 'company' && (
         <div className="space-y-2">
           <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-light">Company Name</label>
           <div className="flex items-center gap-3 auth-input px-3 py-3">
             <Briefcase className="w-4 h-4 text-foreground-muted" />
             <input
               type="text"
               name="companyName"
               autoComplete="organization"
               value={companyName}
               onChange={(e) => setCompanyName(e.target.value)}
               placeholder="Your company name"
               className="bg-transparent outline-none w-full text-foreground placeholder-foreground-muted text-[15px] leading-6"
               required={role === 'company'}
             />
           </div>
         </div>
       )}

       <div className="space-y-2">
         <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-light">Password</label>
         <div className="flex items-center gap-3 auth-input px-3 py-3">
           <Lock className="w-4 h-4 text-foreground-muted" />
           <input
             type={showPassword ? 'text' : 'password'}
             name="password"
             autoComplete="new-password"
             value={password}
             onChange={(e) => setPassword(e.target.value)}
             placeholder="••••••••"
             className="bg-transparent outline-none w-full text-foreground placeholder-foreground-muted text-[15px] leading-6"
             required
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
       </div>

       <div className="space-y-2">
         <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-light">Confirm Password</label>
         <div className="flex items-center gap-3 auth-input px-3 py-3">
           <Lock className="w-4 h-4 text-foreground-muted" />
           <input
             type={showConfirmPassword ? 'text' : 'password'}
             name="confirmPassword"
             autoComplete="new-password"
             value={confirmPassword}
             onChange={(e) => setConfirmPassword(e.target.value)}
             placeholder="••••••••"
             className="bg-transparent outline-none w-full text-foreground placeholder-foreground-muted text-[15px] leading-6"
             required
           />
           <button
             type="button"
             onClick={() => setShowConfirmPassword((current) => !current)}
             className="rounded-full p-2 text-foreground-muted transition hover:bg-slate-100 hover:text-electric-blue"
             aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
           >
             {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
           </button>
         </div>
       </div>

       <button
         type="submit"
         disabled={isLoading || !role}
         className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50"
       >
         {isLoading ? (
           <>
             <Loader className="w-4 h-4 animate-spin" />
             Creating account...
           </>
         ) : (
           'Sign Up'
         )}
       </button>

       <p className="text-center text-sm text-foreground-muted">
         Already have an account?{' '}
         <Link href={loginPath} className="font-semibold text-cyber-purple transition hover:text-electric-blue">
           Login
         </Link>
       </p>
     </form>
   </div>
  );
}
