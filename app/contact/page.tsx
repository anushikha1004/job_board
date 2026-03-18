import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Layout';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact TechHire support for product, trust, and account issues.',
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full px-6 py-10 xl:px-12">
        <section className="glass rounded-2xl p-7 md:p-9">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">Contact TechHire</h1>
          <p className="mt-3 text-foreground-muted">
            Reach the right channel based on your issue.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-glass-border p-5">
              <h2 className="text-xl font-semibold text-foreground">General Support</h2>
              <p className="mt-2 text-sm text-foreground-light">Account setup, login issues, profile updates.</p>
              <a href="mailto:support@techhire.com" className="mt-3 inline-flex text-sm font-semibold text-electric-blue">
                support@techhire.com
              </a>
            </article>
            <article className="rounded-xl border border-glass-border p-5">
              <h2 className="text-xl font-semibold text-foreground">Trust & Safety</h2>
              <p className="mt-2 text-sm text-foreground-light">Report suspicious jobs, abuse, or security concerns.</p>
              <a href="mailto:trust@techhire.com" className="mt-3 inline-flex text-sm font-semibold text-electric-blue">
                trust@techhire.com
              </a>
            </article>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/about" className="btn-secondary px-4 py-2">About</Link>
            <Link href="/privacy" className="btn-secondary px-4 py-2">Privacy</Link>
            <Link href="/terms" className="btn-secondary px-4 py-2">Terms</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
