'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ConsentSettingsButton } from './consent-settings-button';

export function PublicFooter() {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const storedAccepted = window.localStorage.getItem('the-tool-printer-disclaimer-accepted') === 'true';
    queueMicrotask(() => setAccepted(storedAccepted));
  }, []);

  const accept = () => {
    window.localStorage.setItem('the-tool-printer-disclaimer-accepted', 'true');
    setAccepted(true);
  };

  return (
    <footer className="border-t border-neutral-800 bg-[#09090a] px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-yellow-400">Important disclaimer</p>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            The Tool Printer is an experimental AI-assisted intelligence and editorial system. Content is provided for
            informational purposes only, may contain errors, and is not legal, financial, investment, security, or
            professional advice. No warranties are made about accuracy, completeness, availability, or fitness for any
            purpose. Always verify source material before relying on it.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 font-mono text-[10px] uppercase tracking-[0.2em]">
            <Link href="/" className="text-neutral-300 hover:text-yellow-200">Home</Link>
            <Link href="/what-is-this" className="text-neutral-300 hover:text-yellow-200">What is this?</Link>
            <Link href="/about" className="text-neutral-300 hover:text-yellow-200">About the system</Link>
            <Link href="/report" className="text-yellow-300 hover:text-yellow-200">System report</Link>
            <Link href="/favorites" className="text-neutral-300 hover:text-rose-200">Favorites</Link>
            <Link href="/architecture" className="text-neutral-500 hover:text-neutral-200">Architecture</Link>
            <Link href="/blog" className="text-neutral-500 hover:text-neutral-200">Blog</Link>
            <Link href="/terms" className="text-neutral-500 hover:text-neutral-200">Terms</Link>
            <Link href="/privacy" className="text-neutral-500 hover:text-neutral-200">Privacy</Link>
            <Link href="/cookie-policy" className="text-neutral-500 hover:text-neutral-200">Cookie policy</Link>
            <Link href="/disclaimer" className="text-neutral-500 hover:text-neutral-200">Disclaimer</Link>
            <ConsentSettingsButton className="uppercase text-neutral-500 hover:text-neutral-200" />
          </div>
        </div>
        {!accepted ? (
          <button
            type="button"
            onClick={accept}
            className="self-start rounded-md border border-neutral-700 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-300 transition-colors hover:border-yellow-400/60 hover:text-yellow-200 lg:self-auto"
          >
            I understand
          </button>
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-700">Disclaimer acknowledged</p>
        )}
      </div>
    </footer>
  );
}
