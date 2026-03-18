import Link from 'next/link';
import { Building2, ShieldCheck, UserRoundCheck, Zap } from 'lucide-react';
import { Header } from '@/components/Layout';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn how TechHire helps candidates and recruiters with role-based hiring workflows.',
  alternates: {
    canonical: '/about',
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto w-full px-6 py-10 xl:px-12">
        <section className="glass rounded-2xl p-7 md:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyber-purple">About TechHire</p>
          <h1 className="mt-3 text-4xl font-black text-foreground md:text-5xl">A focused platform for modern tech hiring.</h1>
          <p className="mt-4 max-w-4xl text-base text-foreground-muted md:text-lg">
            TechHire connects candidates and recruiters through a clean role-based experience.
            Candidates discover verified opportunities, while recruiters publish roles and manage applications in one workflow.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/" className="btn-primary px-5 py-2">Browse Jobs</Link>
            <Link href="/company" className="btn-secondary px-5 py-2">Post a Job</Link>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <article className="glass rounded-2xl p-6">
            <UserRoundCheck className="h-6 w-6 text-electric-blue" />
            <h2 className="mt-3 text-xl font-bold text-foreground">Role-based Flows</h2>
            <p className="mt-2 text-sm text-foreground-muted">
              Separate candidate and recruiter experiences for clearer navigation and better onboarding.
            </p>
          </article>

          <article className="glass rounded-2xl p-6">
            <Building2 className="h-6 w-6 text-electric-blue" />
            <h2 className="mt-3 text-xl font-bold text-foreground">Real Company Profiles</h2>
            <p className="mt-2 text-sm text-foreground-muted">
              Company pages include profile details, job postings, applicant pipeline, and account controls.
            </p>
          </article>

          <article className="glass rounded-2xl p-6">
            <Zap className="h-6 w-6 text-electric-blue" />
            <h2 className="mt-3 text-xl font-bold text-foreground">Fast Discovery</h2>
            <p className="mt-2 text-sm text-foreground-muted">
              Two-field search, advanced filters, pagination, favorites, and dedicated applications tracking.
            </p>
          </article>

          <article className="glass rounded-2xl p-6">
            <ShieldCheck className="h-6 w-6 text-electric-blue" />
            <h2 className="mt-3 text-xl font-bold text-foreground">Secure Foundation</h2>
            <p className="mt-2 text-sm text-foreground-muted">
              Firebase auth and rules, account settings, and secure resume upload through verified server API.
            </p>
          </article>
        </section>

        <section className="mt-6 glass rounded-2xl p-7 md:p-8">
          <h2 className="text-2xl font-bold text-foreground">What makes TechHire different</h2>
          <ul className="mt-4 space-y-2 text-sm text-foreground-light">
            <li>• Candidate and recruiter routes are separated for a professional, low-friction journey.</li>
            <li>• Application state is visible for both sides with clear statuses and notifications.</li>
            <li>• Account settings include communication preferences and security controls.</li>
            <li>• Built for clarity, speed, and scalability from MVP to production rollout.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
