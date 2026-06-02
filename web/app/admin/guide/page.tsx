import Link from 'next/link';
import { connection } from 'next/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Step = {
  href: string;
  page: string;
  what: string;
  doThis: string;
  phase: 'Configure' | 'Curate' | 'Operate' | 'Monitor';
};

const STEPS: Step[] = [
  {
    href: '/admin/health',
    page: 'System Health',
    phase: 'Configure',
    what: 'Live checklist of environment, database, content, automation, and AI scoring.',
    doThis: 'Start here. Get everything green (warnings are usually fine pre-launch) before doing anything else.',
  },
  {
    href: '/admin/ai-providers',
    page: 'AI Providers',
    phase: 'Configure',
    what: 'Connects the LLM used to score items. Keys are stored encrypted in Supabase Vault.',
    doThis: 'Add a provider key (or set ANTHROPIC_API_KEY), pick a model, and mark it active for scoring.',
  },
  {
    href: '/admin/prompts',
    page: 'Prompts & Thresholds',
    phase: 'Configure',
    what: 'The versioned scoring prompt (Quality Manager) and the score thresholds for routing.',
    doThis: 'Read the active prompt so you know how items are judged. Edit only once you have a feel for results.',
  },
  {
    href: '/admin/controller',
    page: 'Front Page Controller',
    phase: 'Configure',
    what: 'Cadence, how many articles show, and the publishing gate: human / hybrid / auto.',
    doThis: 'Begin in "human" mode so nothing publishes without you. Move to hybrid/auto once you trust the scores.',
  },
  {
    href: '/admin/feeds',
    page: 'Feeds',
    phase: 'Curate',
    what: 'The data sources ingested each run — RSS, YouTube, X, GitHub, LinkedIn.',
    doThis: 'Review the seeded feeds, deactivate any you do not want, and add your own.',
  },
  {
    href: '/admin/people',
    page: 'People to Follow',
    phase: 'Curate',
    what: 'The curated "people to follow" list shown on the home page.',
    doThis: 'Trim or extend the seeded list to match your editorial voice.',
  },
  {
    href: '/admin/knowledge',
    page: 'Knowledge Blocks',
    phase: 'Curate',
    what: 'The Models / Context / Memory / Skills reference cards on the home page.',
    doThis: 'Update these to current tools and models — they are static until you change them.',
  },
  {
    href: '/admin/ingestion',
    page: 'Ingestion',
    phase: 'Operate',
    what: 'Trigger an ingest run on demand and test individual source adapters (incl. Apify).',
    doThis: 'Run ingest once manually so the queue fills and you can see scoring in action.',
  },
  {
    href: '/admin/operations',
    page: 'Operations Console',
    phase: 'Monitor',
    what: 'Live surveillance of pipeline runs — per-step events, counts, and errors.',
    doThis: 'Watch your first ingest run here to confirm sources fetch and items score.',
  },
  {
    href: '/admin/queue',
    page: 'Pipeline Queue',
    phase: 'Operate',
    what: 'Scored, pending items waiting for a decision, highest score first.',
    doThis: 'Approve the good ones (they hit the home page), reject the rest. Batch approve by score.',
  },
  {
    href: '/admin/approvals',
    page: 'Human Review Desk',
    phase: 'Operate',
    what: 'A focused review surface for working through items with full scorecards.',
    doThis: 'Use this when you want to review deliberately rather than blast through the queue.',
  },
  {
    href: '/admin/rejected',
    page: 'Rejected Items',
    phase: 'Operate',
    what: 'Auto- and manually-rejected items, with promote/publish and auto-archive.',
    doThis: 'Skim occasionally to catch anything the scorer wrongly dropped; promote if missed.',
  },
  {
    href: '/admin/financials',
    page: 'Financials',
    phase: 'Monitor',
    what: 'Daily rolled-up token usage and AI cost.',
    doThis: 'Check after a few runs to understand your scoring spend.',
  },
  {
    href: '/admin/security',
    page: 'Security',
    phase: 'Monitor',
    what: 'Security posture and access signals.',
    doThis: 'Glance at it after deploy; revisit if anything looks off.',
  },
  {
    href: '/admin/dashboard',
    page: 'Dashboard',
    phase: 'Monitor',
    what: 'At-a-glance counts and recent pipeline runs.',
    doThis: 'Your daily landing spot once everything is running.',
  },
];

const PHASE_COLORS: Record<Step['phase'], string> = {
  Configure: 'bg-sky-500/15 text-sky-600',
  Curate: 'bg-violet-500/15 text-violet-600',
  Operate: 'bg-emerald-500/15 text-emerald-600',
  Monitor: 'bg-amber-500/15 text-amber-600',
};

export default async function GuidePage() {
  await connection();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">First-time admin guide</h1>
        <p className="text-sm text-muted-foreground">
          A page-by-page walkthrough in the order a new operator should tackle them. Configure → curate
          → operate → monitor.
        </p>
      </div>

      <ol className="space-y-3">
        {STEPS.map((step, i) => (
          <li key={step.href}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">
                    <span className="text-muted-foreground mr-2">{i + 1}.</span>
                    <Link href={step.href} className="hover:underline">
                      {step.page}
                    </Link>
                  </CardTitle>
                  <Badge className={PHASE_COLORS[step.phase]}>{step.phase}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <p className="text-sm text-muted-foreground">{step.what}</p>
                <p className="text-sm">
                  <span className="font-medium">Do this: </span>
                  {step.doThis}
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <p className="text-xs text-muted-foreground">
        Tip: after configuring, run an ingest from <Link href="/admin/ingestion" className="underline">Ingestion</Link>,
        watch it in <Link href="/admin/operations" className="underline">Operations</Link>, then approve
        from the <Link href="/admin/queue" className="underline">Queue</Link>.
      </p>
    </div>
  );
}
