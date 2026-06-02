import Link from 'next/link';

export const metadata = {
  title: 'Disclaimer — The Tool Printer',
  description: 'Disclaimer for The Tool Printer content and AI-assisted outputs.',
};

export default function DisclaimerPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-200">
          &larr; Back to The Tool Printer
        </Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight">Disclaimer</h1>
        <div className="mt-8 space-y-5 text-base leading-8 text-neutral-400">
          <p>
            This site uses AI-assisted ingestion, summarization, scoring, routing, and editorial
            workflows. AI-generated or AI-assisted content can be incomplete, outdated, misleading,
            duplicated, or wrong.
          </p>
          <p>
            No warranties are made about accuracy, completeness, availability, reliability,
            non-infringement, or fitness for a particular purpose. All content is provided as-is.
          </p>
          <p>
            The Tool Printer is not responsible for decisions made based on site content or linked
            third-party material. Verify original sources and seek qualified advice where needed.
          </p>
        </div>
      </div>
    </main>
  );
}
