import Link from 'next/link';

export const metadata = {
  title: 'Privacy — The Tool Printer',
  description: 'Privacy notice for The Tool Printer.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-200">
          &larr; Back to The Tool Printer
        </Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight">Privacy Notice</h1>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-600">
          Last updated 24 May 2026
        </p>
        <div className="mt-8 space-y-5 text-base leading-8 text-neutral-400">
          <p>
            The Tool Printer is built to collect as little as possible. We do not run advertising
            pixels, social-media trackers, session-replay tools, or live-chat widgets, and we do not
            sell or share personal information.
          </p>
          <p>
            <strong className="text-neutral-200">Analytics.</strong> With your consent we use Vercel
            Web Analytics, a privacy-friendly, cookieless service, to count page views and monitor
            site health. This analytics script does not load until you click &ldquo;Accept&rdquo; on
            the consent bar; if you decline or ignore it, no analytics is collected. We may also keep
            server operational logs (for example request and error logs) needed to run and secure the
            service.
          </p>
          <p>
            <strong className="text-neutral-200">Cookies &amp; storage.</strong> Public pages set no
            tracking cookies. A secure session cookie is used only when an administrator signs in.
            For full details and to change your analytics choice at any time, see our{' '}
            <Link href="/cookie-policy" className="underline hover:text-neutral-300">Cookie &amp; Tracking Policy</Link>.
          </p>
          <p>
            The site may link to third-party sources such as news sites, video platforms, social
            networks, and research pages. Those services have their own privacy practices.
          </p>
          <p>
            <strong className="text-neutral-200">Your choices.</strong> California residents and
            others may opt out of analytics using the consent bar or the &ldquo;Cookie settings&rdquo;
            control in the footer. Do not submit sensitive personal, client, legal, financial, or
            confidential information through public surfaces on this site.
          </p>
        </div>
      </div>
    </main>
  );
}
