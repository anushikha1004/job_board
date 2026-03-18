import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Layout';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Review the terms for using TechHire as a candidate or recruiter.',
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full px-6 py-10 xl:px-12">
        <section className="glass rounded-2xl p-7 md:p-9">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">Terms of Service</h1>
          <p className="mt-2 text-sm text-foreground-muted">Last updated: March 6, 2026</p>
          <div className="mt-6 space-y-5 text-sm leading-relaxed text-foreground-light">
            <p>
              By using TechHire, you agree to provide accurate profile and job information, and to use the platform lawfully.
            </p>
            <p>
              Recruiters are responsible for the accuracy of postings and application URLs. Candidates are responsible for
              the accuracy of submitted profile and resume details.
            </p>
            <p>
              TechHire may suspend accounts that post misleading jobs, abusive content, or attempt unauthorized data access.
            </p>
            <p>
              The service is provided on an as-is basis. We aim for high availability but do not guarantee uninterrupted access.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/privacy" className="btn-secondary px-4 py-2">Privacy</Link>
            <Link href="/contact" className="btn-secondary px-4 py-2">Contact</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
