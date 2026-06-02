import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { BackOnEscape } from '@/components/system/back-on-escape';
import { PublicFooter } from '@/components/system/public-footer';
import { RegisterForm } from '@/components/landing/register-form';

export const metadata = {
  title: 'What is this? — The Tool Printer',
  description:
    'The Tool Printer is an AI intelligence and editorial system that governs its own output. A short tour.',
};

const fastFacts: Array<[string, string]> = [
  ['What it is', 'An AI-curated intelligence feed for operators thinking about agency, governance, trust, and enterprise automation.'],
  ['Why it exists', 'Most AI news is slop. This system reads everything for you, scores it, and only publishes what survives editorial governance.'],
  ['Who runs it', 'Built and edited by Geoff Hopkins. The agents do the reading; a human makes the call on what ships.'],
  ['What you get', 'A small daily front page, an infinite older stream, a blog, and a transparent system report on costs and cadence.'],
];

export default function WhatIsThisPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#0b0b0d] text-neutral-100">
      <BackOnEscape />
      <div className="border-b border-neutral-800/90 bg-[#0b0b0d]/95">
        <div className="mx-auto flex max-w-[1800px] items-center gap-6 px-4 py-3 sm:px-8">
          <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.34em] text-neutral-400 hover:text-neutral-100">
            &larr; The Tool Printer
          </Link>
        </div>
      </div>

      <section className="flex min-h-[calc(100vh-60px)] items-center px-4 py-6 sm:px-8">
        <div className="mx-auto grid w-full max-w-[1500px] gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.46em] text-yellow-400">
              The short answer
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[0.98] tracking-tight text-white sm:text-5xl xl:text-6xl">
              A governed AI <span className="font-serif italic text-yellow-300">front page</span> for people who have to decide.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-300 sm:text-lg sm:leading-8">
              The Tool Printer reads the AI field for you. Agents pull from news, research,
              LinkedIn/X, YouTube, and GitHub; score each item against an editorial scorecard;
              and queue everything for a human reviewer before it shows up here.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/about"
                className="inline-flex items-center gap-2 rounded-md border border-yellow-300/40 bg-yellow-400 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-950 transition-colors hover:bg-yellow-300"
              >
                How it works
                <ArrowUpRight className="size-3.5" />
              </Link>
              <Link
                href="/architecture"
                className="inline-flex items-center gap-2 rounded-md border border-neutral-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-300 transition-colors hover:border-yellow-400/60 hover:text-yellow-200"
              >
                Architecture
                <ArrowUpRight className="size-3.5" />
              </Link>
              <Link
                href="/report"
                className="inline-flex items-center gap-2 rounded-md border border-yellow-500/30 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.24em] text-yellow-300 transition-colors hover:border-yellow-400 hover:text-yellow-200"
              >
                System report
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:content-center">
            {fastFacts.map(([label, body]) => (
              <article key={label} className="rounded-md border border-neutral-800 bg-neutral-950/50 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-yellow-400">{label}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-200">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-neutral-800/80 bg-[#0a0a0c] px-4 py-12 sm:px-8">
        <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.46em] text-yellow-400">Tokenmaxxing</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
              Stop burning tokens on slop someone else already scored.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-neutral-400">
              The future of AI is leverage. There&rsquo;s no point spending your own context window
              chewing through raw RSS, LinkedIn drift, and YouTube transcripts when the
              orchestration has already been done. The Tool Printer scores, ranks, and reviews —
              you pull the synthesised output.
            </p>
            <p className="mt-4 max-w-xl text-base leading-7 text-neutral-400">
              A read API is coming in v0.2 so your harness (Claude Code, Codex, n8n, anything that
              speaks HTTP) can hit it directly. Register your email and we&rsquo;ll send the token
              the moment it ships.
            </p>
          </div>
          <RegisterForm />
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
