import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { BackOnEscape } from '@/components/system/back-on-escape';
import { PublicFooter } from '@/components/system/public-footer';

export const metadata = {
  title: 'About the system — The Tool Printer',
  description:
    'How The Tool Printer works: an automated intelligence loop with retroactive human governance and anti-slop quality control.',
};

const operatingLoop: Array<[string, string, string]> = [
  ['01', 'Signal capture', 'Every run pulls AI news, YouTube channels, LinkedIn/X posts, research, GitHub, and operator sources into one queue.'],
  ['02', 'Agent drafting', 'Agents summarize, score, tag, route, and assemble newsletter-ready briefs from the raw material.'],
  ['03', 'Performance loops', 'Follow-on agents watch engagement, compare angles, and turn A/B results into better future framing.'],
  ['04', 'Human governance', 'Editorial review happens retroactively and deliberately: approve, reject, correct, and teach the system what signal means.'],
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0b0b0d] text-neutral-100">
      <BackOnEscape />
      <div className="border-b border-neutral-800/90 bg-[#0b0b0d]/95">
        <div className="mx-auto flex max-w-[1800px] items-center gap-6 px-4 py-4 sm:px-8">
          <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.34em] text-neutral-400 hover:text-neutral-100">
            &larr; The Tool Printer
          </Link>
        </div>
      </div>

      <section className="border-b border-neutral-800/90 bg-[#0f0f11] px-4 py-16 sm:px-8">
        <div className="mx-auto grid max-w-[1800px] gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.42em] text-yellow-400">
              About the system
            </p>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-6xl">
              A smarter way to govern output away from AI slop.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-neutral-400">
              The Tool Printer is not just an AI newsletter. It is a fully automated intelligence
              loop with human judgment built back in: agents gather the field, draft the brief,
              measure performance, test angles, and feed the learning back into the next run.
            </p>

            <div className="mt-8 rounded-md border border-yellow-500/25 bg-yellow-500/[0.06] p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-yellow-400">
                Cadence
              </p>
              <p className="mt-3 text-base leading-7 text-neutral-200">
                The ingest workflow gets an hourly clock tick, then the admin controller decides
                whether the next governed run is due. Admin controls manage feeds, keys, review
                queues, and manual checks; the public face shows the governed output.
              </p>
            </div>

            <Link
              href="/architecture"
              className="mt-8 inline-flex items-center gap-2 rounded-md border border-yellow-300/40 bg-yellow-400 px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-950 transition-colors hover:bg-yellow-300"
            >
              Read the architecture
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {operatingLoop.map(([num, title, body]) => (
              <article key={num} className="rounded-md border border-neutral-800 bg-neutral-950/50 p-5">
                <span className="font-mono text-[10px] text-yellow-400">{num}</span>
                <h2 className="mt-5 text-2xl font-semibold leading-tight text-white">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-neutral-500">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
