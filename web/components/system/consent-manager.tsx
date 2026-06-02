'use client';

import { Analytics } from '@vercel/analytics/next';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Opt-in consent gate for non-essential analytics.
 *
 * Vercel Web Analytics is the only tracker on the site. We do NOT mount it
 * until the visitor explicitly clicks "Accept" — so no analytics script,
 * request, or storage happens before consent. The choice is remembered in
 * localStorage and can be reopened from the footer via the
 * `ttp:open-consent` window event.
 *
 * Strictly-necessary cookies (admin auth) and functional UI state (the
 * disclaimer flag) are exempt and not gated here.
 */

const STORAGE_KEY = 'ttp-analytics-consent';

type Consent = 'granted' | 'denied';

export const CONSENT_EVENT = 'ttp:open-consent';

// Returns false during SSR and the first hydration render, then true. Lets us
// render identical markup on the server and client (no hydration mismatch)
// while still reading localStorage on the client only.
function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function readStoredConsent(): Consent | null {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'granted' || stored === 'denied' ? stored : null;
}

export function ConsentManager() {
  const hydrated = useHydrated();
  // null = follow stored value; set once the visitor makes a choice this session.
  const [choice, setChoice] = useState<Consent | null>(null);
  const [forceOpen, setForceOpen] = useState(false);

  useEffect(() => {
    const reopen = () => setForceOpen(true);
    window.addEventListener(CONSENT_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_EVENT, reopen);
  }, []);

  if (!hydrated) return null;

  const consent = choice ?? readStoredConsent();
  const barOpen = forceOpen || consent === null;

  const select = (value: Consent) => {
    window.localStorage.setItem(STORAGE_KEY, value);
    setChoice(value);
    setForceOpen(false);
  };

  return (
    <>
      {consent === 'granted' && <Analytics />}
      {barOpen && (
        <div
          role="dialog"
          aria-label="Analytics consent"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-800 bg-[#09090a]/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-[#09090a]/80 sm:px-8"
        >
          <div className="mx-auto flex max-w-[1800px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-3xl text-sm leading-6 text-neutral-400">
              We use privacy-friendly, cookieless analytics to count page views and keep the site
              healthy. Nothing loads until you choose.{' '}
              <Link href="/cookie-policy" className="text-neutral-300 underline hover:text-yellow-200">
                Cookie policy
              </Link>
              .
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => select('denied')}
                className="rounded-md border border-neutral-700 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => select('granted')}
                className="rounded-md border border-yellow-400/60 bg-yellow-400/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-yellow-200 transition-colors hover:border-yellow-400 hover:bg-yellow-400/20"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
