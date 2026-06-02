import Link from 'next/link';
import { BackOnEscape } from '@/components/system/back-on-escape';
import { PublicFooter } from '@/components/system/public-footer';

export const metadata = {
  title: 'Architecture — The Tool Printer',
  description:
    'The Perpetual Business — how signals, scoring, human approvals, publishing, and viewership feed back into themselves to keep the system running.',
};

const LAYERS: Array<{
  index: string;
  title: string;
  body: string;
  paths: string[];
  accent: string;
}> = [
  {
    index: '01',
    title: 'Signal Sources',
    body: 'Topic and keyword agents pull from RSS, X/Twitter, YouTube, GitHub, LinkedIn, and Open Graph image scrapes. Each source is a discrete fetcher — easy to add, easy to silence.',
    paths: ['lib/workflow/steps/fetch-rss.ts', 'lib/workflow/steps/fetch-twitter.ts', 'lib/workflow/steps/fetch-youtube.ts', 'lib/workflow/steps/fetch-github.ts', 'lib/workflow/steps/fetch-linkedin.ts'],
    accent: '#3b82f6',
  },
  {
    index: '02',
    title: 'Ingest Workflow',
    body: 'A scheduled pipeline normalises raw items, deduplicates, and routes them onward. The funnel point — every signal in the system passes through here.',
    paths: ['lib/workflow/feed-schedule.ts', 'lib/workflow/ingest.ts', 'lib/workflow/steps/route-items.ts'],
    accent: '#a855f7',
  },
  {
    index: '03',
    title: 'Proprietary Scorecard',
    body: 'Items are scored against a tunable threshold — relevance, novelty, signal-to-noise. Items below the bar are auto-rejected; items above advance to review.',
    paths: ['lib/scoring/threshold.ts', 'lib/workflow/steps/score-items.ts'],
    accent: '#f59e0b',
  },
  {
    index: '04',
    title: 'Human-in-the-Loop',
    body: 'The approval queue is where the editor (me) intervenes. Approve, reject, or edit. Every decision becomes labelled training signal for the scorecard.',
    paths: ['app/admin/approvals', 'app/admin/queue', 'app/admin/rejected'],
    accent: '#fb923c',
  },
  {
    index: '05',
    title: 'Front-Page Controller',
    body: 'Approved items get placed into sections — hot takes, watchlist, lab notes, vibe, knowledge. The controller decides what shows where, and when it disappears.',
    paths: ['lib/front-page/controller.ts', 'lib/front-page/home-data.ts'],
    accent: '#d946ef',
  },
  {
    index: '06',
    title: 'Public Site',
    body: 'The reader-facing surface. Front page, blog, system report, and the four numbered editions. This is where viewership is generated.',
    paths: ['app/page.tsx', 'app/blog', 'app/report', 'app/1, app/2, app/3, app/4'],
    accent: '#22c55e',
  },
  {
    index: '07',
    title: 'Performance Analytics',
    body: 'Views, dwell, click-through, and source/people stats are captured as events. These metrics are the closing signal of the loop.',
    paths: ['lib/workflow/people-stats.ts', 'lib/workflow/events.ts', 'app/admin/operations'],
    accent: '#06b6d4',
  },
  {
    index: '08',
    title: 'Feedback Loop',
    body: 'Performance metrics reweight the scorecard and inform topic tuning. The system gets smarter about what the audience actually reads — autonomously, with editorial veto.',
    paths: ['lib/scoring/threshold.ts ↺ events'],
    accent: '#facc15',
  },
];

export default function ArchitecturePage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-neutral-100 sm:px-8">
      <BackOnEscape />
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-200">
          &larr; Back to The Tool Printer
        </Link>
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.28em] text-yellow-400">
          The Perpetual Business
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Architecture</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-neutral-400">
          A news engine that listens to topics, scores what matters, asks a human when it needs to,
          publishes, then watches what readers do with it — and uses that to teach itself which
          signals to chase next. Eight layers, one closed loop.
        </p>

        <div className="mt-10 overflow-x-auto rounded-lg border border-neutral-800 bg-[#0b0b0d] p-4 sm:p-6">
          <ArchitectureDiagram />
        </div>

        <ol className="mt-12 space-y-6">
          {LAYERS.map((layer) => (
            <li
              key={layer.index}
              className="rounded-lg border border-neutral-800 bg-[#0b0b0d] p-5 sm:p-6"
            >
              <div className="flex items-baseline gap-4">
                <span
                  className="font-mono text-[11px] uppercase tracking-[0.24em]"
                  style={{ color: layer.accent }}
                >
                  {layer.index}
                </span>
                <h2 className="text-xl font-semibold tracking-tight text-neutral-100">
                  {layer.title}
                </h2>
              </div>
              <p className="mt-3 text-sm leading-7 text-neutral-400">{layer.body}</p>
              <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                {layer.paths.map((path) => (
                  <span
                    key={path}
                    className="rounded border border-neutral-800 px-2 py-1 text-neutral-400"
                  >
                    {path}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-12 text-xs leading-6 text-neutral-600">
          Built with Next.js, Supabase Postgres, and a workflow runner. Storage is row-level audited;
          every approval, rejection, score change, and view is replayable. The site you are reading
          is the output node of the loop above.
        </p>
      </div>
      <PublicFooter />
    </main>
  );
}

function ArchitectureDiagram() {
  const cTitle = '#e5e5e5';
  const cMuted = '#737373';
  const cBox = '#0f0f12';
  const cBorder = '#27272a';

  const colors = {
    src: '#3b82f6',
    ing: '#a855f7',
    sc: '#f59e0b',
    hil: '#fb923c',
    fp: '#d946ef',
    site: '#22c55e',
    perf: '#06b6d4',
    loop: '#facc15',
    admin: '#8b5cf6',
    db: '#22c55e',
  };

  const sources = [
    { x: 250, label: 'RSS' },
    { x: 380, label: 'Twitter / X' },
    { x: 510, label: 'YouTube' },
    { x: 640, label: 'GitHub' },
    { x: 770, label: 'LinkedIn' },
    { x: 900, label: 'OG images' },
  ];

  return (
    <svg
      viewBox="0 0 1200 920"
      role="img"
      aria-label="Perpetual Business architecture diagram"
      className="block w-full min-w-[900px]"
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
        <marker
          id="arrowYellow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={colors.loop} />
        </marker>
      </defs>

      {/* Admin rail */}
      <rect
        x="10"
        y="200"
        width="220"
        height="600"
        rx="10"
        fill={colors.admin}
        fillOpacity="0.05"
        stroke={colors.admin}
        strokeOpacity="0.35"
      />
      <text
        x="22"
        y="222"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        letterSpacing="2.5"
        fill={colors.admin}
      >
        ADMIN CONSOLE
      </text>
      {[
        'Controller',
        'Feeds / Ingestion',
        'Approvals / Rejected',
        'Prompts / Knowledge',
        'People / Stats',
        'Financials / Ops',
      ].map((t, i) => (
        <g key={t}>
          <rect
            x="22"
            y={250 + i * 70}
            width="196"
            height="48"
            rx="6"
            fill={cBox}
            stroke={colors.admin}
            strokeOpacity="0.5"
          />
          <text
            x="120"
            y={250 + i * 70 + 30}
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="13"
            fill={cTitle}
          >
            {t}
          </text>
        </g>
      ))}
      <text
        x="22"
        y="752"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        letterSpacing="1.5"
        fill={cMuted}
      >
        human override
      </text>
      <text
        x="22"
        y="770"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        letterSpacing="1.5"
        fill={cMuted}
      >
        budget · prompts · topics
      </text>

      {/* Storage rail */}
      <rect
        x="970"
        y="200"
        width="220"
        height="600"
        rx="10"
        fill={colors.db}
        fillOpacity="0.05"
        stroke={colors.db}
        strokeOpacity="0.35"
      />
      <text
        x="982"
        y="222"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        letterSpacing="2.5"
        fill={colors.db}
      >
        SUPABASE
      </text>
      {['items', 'scores', 'approvals', 'placements', 'events / views', 'people / stats'].map(
        (t, i) => (
          <g key={t}>
            <rect
              x="982"
              y={250 + i * 70}
              width="196"
              height="48"
              rx="6"
              fill={cBox}
              stroke={colors.db}
              strokeOpacity="0.5"
            />
            <text
              x="1080"
              y={250 + i * 70 + 30}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontSize="13"
              fill={cTitle}
            >
              {t}
            </text>
          </g>
        ),
      )}
      <text
        x="982"
        y="752"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        letterSpacing="1.5"
        fill={cMuted}
      >
        postgres · RLS
      </text>
      <text
        x="982"
        y="770"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        letterSpacing="1.5"
        fill={cMuted}
      >
        full audit trail
      </text>

      {/* 01 Sources */}
      <text
        x="250"
        y="40"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        letterSpacing="2.5"
        fill={colors.src}
      >
        01 — SIGNAL SOURCES
      </text>
      <text
        x="250"
        y="60"
        fontFamily="ui-monospace, monospace"
        fontSize="11"
        fill={cMuted}
      >
        topics &amp; keywords
      </text>
      {sources.map((s) => (
        <g key={s.label}>
          <rect
            x={s.x}
            y="80"
            width="110"
            height="50"
            rx="6"
            fill={cBox}
            stroke={colors.src}
            strokeOpacity="0.7"
          />
          <text
            x={s.x + 55}
            y="110"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="13"
            fill={cTitle}
          >
            {s.label}
          </text>
        </g>
      ))}

      {/* 02 Ingest */}
      <g color={colors.ing}>
        {sources.map((s) => (
          <line
            key={`a${s.x}`}
            x1={s.x + 55}
            y1="130"
            x2="600"
            y2="200"
            stroke={colors.src}
            strokeOpacity="0.5"
            strokeWidth="1.2"
            markerEnd="url(#arrow)"
          />
        ))}
      </g>
      <rect
        x="380"
        y="200"
        width="440"
        height="80"
        rx="8"
        fill={cBox}
        stroke={colors.ing}
      />
      <text
        x="600"
        y="228"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        letterSpacing="2"
        fill={colors.ing}
      >
        02 — INGEST WORKFLOW
      </text>
      <text
        x="600"
        y="252"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui"
        fontSize="14"
        fill={cTitle}
      >
        feed-schedule → fetch → route-items
      </text>
      <text
        x="600"
        y="270"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fill={cMuted}
      >
        lib/workflow/
      </text>

      {/* 03 Score */}
      <line
        x1="500"
        y1="280"
        x2="430"
        y2="340"
        stroke={colors.ing}
        strokeWidth="1.5"
        markerEnd="url(#arrow)"
        color={colors.ing}
      />
      <line
        x1="700"
        y1="280"
        x2="770"
        y2="340"
        stroke={colors.ing}
        strokeWidth="1.5"
        markerEnd="url(#arrow)"
        color={colors.ing}
      />
      <rect
        x="280"
        y="340"
        width="280"
        height="90"
        rx="8"
        fill={cBox}
        stroke={colors.sc}
      />
      <text
        x="420"
        y="368"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        letterSpacing="2"
        fill={colors.sc}
      >
        03 — SCORECARD
      </text>
      <text
        x="420"
        y="392"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui"
        fontSize="14"
        fill={cTitle}
      >
        proprietary signal score
      </text>
      <text
        x="420"
        y="412"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fill={cMuted}
      >
        lib/scoring/threshold.ts
      </text>

      {/* 04 HIL */}
      <rect
        x="640"
        y="340"
        width="280"
        height="90"
        rx="8"
        fill={cBox}
        stroke={colors.hil}
      />
      <text
        x="780"
        y="368"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        letterSpacing="2"
        fill={colors.hil}
      >
        04 — HIL APPROVAL QUEUE
      </text>
      <text
        x="780"
        y="392"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui"
        fontSize="14"
        fill={cTitle}
      >
        approve · reject · edit
      </text>
      <text
        x="780"
        y="412"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fill={cMuted}
      >
        app/admin/approvals
      </text>

      <line
        x1="560"
        y1="385"
        x2="640"
        y2="385"
        stroke={colors.sc}
        strokeWidth="1.5"
        markerEnd="url(#arrow)"
        color={colors.sc}
      />
      <text
        x="600"
        y="378"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fill={cMuted}
      >
        threshold
      </text>

      {/* 05 Front-page */}
      <rect
        x="380"
        y="490"
        width="440"
        height="78"
        rx="8"
        fill={cBox}
        stroke={colors.fp}
      />
      <text
        x="600"
        y="516"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        letterSpacing="2"
        fill={colors.fp}
      >
        05 — FRONT-PAGE CONTROLLER
      </text>
      <text
        x="600"
        y="538"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui"
        fontSize="14"
        fill={cTitle}
      >
        placement · sections · layout
      </text>
      <text
        x="600"
        y="556"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fill={cMuted}
      >
        lib/front-page/controller.ts
      </text>
      <line
        x1="450"
        y1="430"
        x2="520"
        y2="490"
        stroke={colors.sc}
        strokeWidth="1.5"
        markerEnd="url(#arrow)"
        color={colors.sc}
      />
      <line
        x1="750"
        y1="430"
        x2="680"
        y2="490"
        stroke={colors.hil}
        strokeWidth="1.5"
        markerEnd="url(#arrow)"
        color={colors.hil}
      />
      <text
        x="710"
        y="465"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fill={cMuted}
      >
        approved
      </text>

      {/* 06 Public Site */}
      <rect
        x="380"
        y="610"
        width="440"
        height="78"
        rx="8"
        fill={cBox}
        stroke={colors.site}
      />
      <text
        x="600"
        y="636"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        letterSpacing="2"
        fill={colors.site}
      >
        06 — PUBLIC SITE
      </text>
      <text
        x="600"
        y="658"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui"
        fontSize="14"
        fill={cTitle}
      >
        reader views · clicks · dwell
      </text>
      <text
        x="600"
        y="676"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fill={cMuted}
      >
        app/(blog | report | 1-4)
      </text>
      <line
        x1="600"
        y1="568"
        x2="600"
        y2="610"
        stroke={colors.fp}
        strokeWidth="1.5"
        markerEnd="url(#arrow)"
        color={colors.fp}
      />
      <text
        x="615"
        y="594"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fill={cMuted}
      >
        publish
      </text>

      {/* 07 Performance */}
      <rect
        x="380"
        y="730"
        width="440"
        height="80"
        rx="8"
        fill={cBox}
        stroke={colors.perf}
      />
      <text
        x="600"
        y="756"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        letterSpacing="2"
        fill={colors.perf}
      >
        07 — PERFORMANCE ANALYTICS
      </text>
      <text
        x="600"
        y="780"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui"
        fontSize="14"
        fill={cTitle}
      >
        views · CTR · dwell · people-stats
      </text>
      <text
        x="600"
        y="798"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fill={cMuted}
      >
        lib/workflow/events.ts
      </text>
      <line
        x1="600"
        y1="688"
        x2="600"
        y2="730"
        stroke={colors.site}
        strokeWidth="1.5"
        markerEnd="url(#arrow)"
        color={colors.site}
      />

      {/* 08 Loop arrow — clean return lane hugging just left of the storage rail */}
      <path
        d="M 820 770 C 945 760, 945 395, 820 385"
        fill="none"
        stroke={colors.loop}
        strokeWidth="2.5"
        markerEnd="url(#arrowYellow)"
      />
      {/* Label sits in the empty band below the boxes so it clears the storage
          rail (x>=970) and the dotted DB connectors that fill the gap. */}
      <text
        x="840"
        y="818"
        fontFamily="ui-monospace, monospace"
        fontSize="11"
        letterSpacing="2"
        fill={colors.loop}
      >
        08 — LOOP
      </text>
      <text
        x="840"
        y="832"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fill={cMuted}
      >
        feedback · reweight scorecard
      </text>

      {/* Admin dashed connectors */}
      <line
        x1="230"
        y1="385"
        x2="280"
        y2="385"
        stroke={colors.admin}
        strokeWidth="1"
        strokeDasharray="4 4"
        markerEnd="url(#arrow)"
        color={colors.admin}
      />
      <line
        x1="230"
        y1="385"
        x2="640"
        y2="385"
        stroke={colors.admin}
        strokeWidth="1"
        strokeDasharray="4 4"
        opacity="0.5"
      />
      <line
        x1="230"
        y1="525"
        x2="380"
        y2="525"
        stroke={colors.admin}
        strokeWidth="1"
        strokeDasharray="4 4"
        markerEnd="url(#arrow)"
        color={colors.admin}
      />

      {/* DB dotted connectors */}
      <line
        x1="820"
        y1="240"
        x2="970"
        y2="270"
        stroke={colors.db}
        strokeWidth="1"
        strokeDasharray="2 4"
        opacity="0.6"
      />
      <line
        x1="820"
        y1="385"
        x2="970"
        y2="385"
        stroke={colors.db}
        strokeWidth="1"
        strokeDasharray="2 4"
        opacity="0.6"
      />
      <line
        x1="820"
        y1="650"
        x2="970"
        y2="525"
        stroke={colors.db}
        strokeWidth="1"
        strokeDasharray="2 4"
        opacity="0.6"
      />
      <line
        x1="820"
        y1="770"
        x2="970"
        y2="595"
        stroke={colors.db}
        strokeWidth="1"
        strokeDasharray="2 4"
        opacity="0.6"
      />

      {/* Legend */}
      <g>
        <rect x="20" y="850" width="14" height="3" fill={colors.loop} />
        <text x="40" y="855" fontFamily="ui-monospace, monospace" fontSize="10" fill={cMuted}>
          perpetual feedback loop
        </text>
        <rect x="220" y="850" width="14" height="2" fill={colors.admin} />
        <text x="240" y="855" fontFamily="ui-monospace, monospace" fontSize="10" fill={cMuted}>
          human override (dashed)
        </text>
        <rect x="430" y="850" width="14" height="2" fill={colors.db} />
        <text x="450" y="855" fontFamily="ui-monospace, monospace" fontSize="10" fill={cMuted}>
          storage write/read (dotted)
        </text>
      </g>
    </svg>
  );
}
