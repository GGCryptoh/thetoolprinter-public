import Link from 'next/link';
import { ConsentSettingsButton } from '@/components/system/consent-settings-button';

export const metadata = {
  title: 'Cookie & Tracking Policy — The Tool Printer',
  description: 'How The Tool Printer uses cookies, local storage, and analytics, and how to control them.',
};

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-200">
          &larr; Back to The Tool Printer
        </Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight">Cookie &amp; Tracking Policy</h1>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-600">
          Last updated 24 May 2026
        </p>

        <div className="mt-8 space-y-5 text-base leading-8 text-neutral-400">
          <p>
            This page explains the cookies, browser storage, and analytics used by The Tool Printer,
            and how you can control them. We keep tracking deliberately minimal.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-neutral-100">Analytics (consent required)</h2>
          <p>
            We use <strong className="text-neutral-200">Vercel Web Analytics</strong>, a
            privacy-friendly, cookieless analytics service, to count page views and monitor site
            health. It does not set advertising cookies, does not build cross-site profiles, and
            does not sell or share your data with advertising networks.
          </p>
          <p>
            This analytics script <strong className="text-neutral-200">does not load until you
            click &ldquo;Accept&rdquo;</strong> on the consent bar. If you decline or ignore the
            bar, no analytics request is ever made from your browser. Your choice is stored in your
            browser&rsquo;s local storage so we don&rsquo;t ask again on every visit.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-neutral-100">Strictly necessary storage</h2>
          <p>
            These are required for the site to function and do not require consent. The{' '}
            <span className="font-mono text-sm text-neutral-200">the-tool-printer-disclaimer-accepted</span>{' '}
            and <span className="font-mono text-sm text-neutral-200">ttp-analytics-consent</span>{' '}
            local-storage flags remember that you acknowledged the disclaimer and recorded your
            analytics choice. They stay on your device and are not sent to us.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-neutral-100">No third-party trackers</h2>
          <p>
            We do not run Google Analytics, advertising or social-media pixels (such as Meta or
            TikTok), session-replay tools, or live-chat widgets. Pages may link out to third-party
            sites (news, video, research); those services have their own policies once you follow a
            link.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-neutral-100">Changing your choice</h2>
          <p>
            You can change your analytics preference at any time:
          </p>
          <p>
            <ConsentSettingsButton className="rounded-md border border-neutral-700 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-200 transition-colors hover:border-yellow-400/60 hover:text-yellow-200" />
          </p>
          <p>
            You can also clear this site&rsquo;s data in your browser settings to reset all choices.
          </p>

          <p className="pt-4 text-sm text-neutral-500">
            See also our{' '}
            <Link href="/privacy" className="underline hover:text-neutral-300">Privacy Notice</Link>{' '}
            and{' '}
            <Link href="/terms" className="underline hover:text-neutral-300">Terms of Use</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
