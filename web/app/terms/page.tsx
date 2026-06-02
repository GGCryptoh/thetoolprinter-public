import Link from 'next/link';

export const metadata = {
  title: 'Terms — The Tool Printer',
  description: 'Terms of use for The Tool Printer.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <p>
        The Tool Printer is an experimental AI-assisted intelligence and editorial system. By using
        this site, you agree that the material is provided for informational purposes only and that
        you are responsible for verifying source material before relying on it.
      </p>
      <p>
        We do not promise that the site, feeds, summaries, scores, workflows, reports, or linked
        sources will be accurate, complete, timely, uninterrupted, secure, or suitable for any
        particular purpose.
      </p>
      <p>
        Nothing on this site is legal, financial, investment, security, procurement, or professional
        advice. You should use independent judgment and qualified advisors before making decisions.
      </p>
    </LegalPage>
  );
}

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-200">
          &larr; Back to The Tool Printer
        </Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-8 space-y-5 text-base leading-8 text-neutral-400">{children}</div>
      </div>
    </main>
  );
}
