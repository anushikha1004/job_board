import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Layout';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Read how TechHire collects, uses, and protects your data.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full px-6 py-10 xl:px-12">
        <section className="glass rounded-2xl p-7 md:p-9">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">Privacy Policy</h1>
          <p className="mt-2 text-sm text-foreground-muted">Last updated: March 6, 2026</p>
          <div className="mt-6 space-y-5 text-sm leading-relaxed text-foreground-light">
            <p>
              TechHire stores account, profile, applications, and activity data to provide candidate and recruiter features.
              We process data using Firebase services and your configured integrations.
            </p>
            <p>
              We use your email for authentication, account notices, and optional product communication based on your account settings.
              You can update communication preferences in account settings.
            </p>
            <p>
              Recruiters can access candidate data only for applications submitted to their jobs. Candidates can access only their
              own data. Firestore security rules enforce access boundaries.
            </p>
            <p>
              You may request account deletion and data removal by contacting support. Resume links may expire and must be refreshed
              from your profile when needed.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/terms" className="btn-secondary px-4 py-2">Terms</Link>
            <Link href="/contact" className="btn-secondary px-4 py-2">Contact</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
