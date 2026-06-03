'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  FileText,
  Heart,
  Radio,
  Sparkles,
  X,
} from 'lucide-react';
import type { NewsItem } from '@/lib/supabase/types';
import type { FrontPageSectionControl } from '@/lib/front-page/controller';
import { computeWeightedScore, getDisplayScore } from '@/lib/front-page/score';
import { decodeHtmlEntities } from '@/lib/text';
import { NewItemsProvider, useLastVisit } from '@/components/landing/new-items-provider';
import { FavoritesIndicator } from '@/components/landing/favorites-indicator';
import { PublicFooter } from '@/components/system/public-footer';
import { BackToTop } from '@/components/system/back-to-top';
import { isFavoriteId, useFavorites } from '@/lib/client/favorites';

interface EditorialStory {
  id?: string;
  kicker: string;
  title: string;
  source: string;
  score: string;
  summary: string;
  href?: string;
  createdAt?: string | null;
  scorecard?: Record<string, unknown> | null;
}

interface IntelligenceItem {
  id?: string;
  title: string;
  source: string;
  kind: string;
  score?: string;
  scorecard?: Record<string, unknown> | null;
  summary: string;
  href?: string | null;
  createdAt?: string | null;
}

const topStories: EditorialStory[] = [
  {
    kicker: 'Agency Governance',
    title: 'The supervisor layer is becoming the board-level control plane',
    source: 'Field memo',
    score: '9.7',
    summary:
      'Agent risk is moving from prompt quality to runtime accountability: approvals, logs, escalation rights, and post-incident reconstruction.',
  },
  {
    kicker: 'Enterprise AI',
    title: 'The next moat is indemnified execution, not model access',
    source: 'Market read',
    score: '9.3',
    summary:
      'As models commoditize, buyers pay for counterparties who can absorb operating risk and document judgment.',
  },
  {
    kicker: 'Regulation',
    title: 'AI assurance is drifting toward financial-control language',
    source: 'Governance watch',
    score: '8.9',
    summary:
      'Expect agent controls to look less like model cards and more like audit trails, segregation of duties, and exception reporting.',
  },
];

const olderFeed = [
  'Why every AI pilot needs a failure budget before it needs a dashboard',
  'LinkedIn note: Consulting firms are underpricing the agency transition',
  'Paper trail: Runtime policy should be inspectable by non-engineers',
  'Signal: Open-source agent scaffolds are converging on the same primitives',
  'Field note: The buyer now asks who is liable when the agent acts',
  'LinkedIn note: Prompt libraries are becoming workflow documentation',
  'Research digest: Evaluation moves from benchmarks to operational tests',
  'Governance brief: Decision rights matter more than model routing',
];

const questions = [
  'Where does liability sit when an agent completes the task?',
  'What must be logged for a partner, regulator, or client to trust the output?',
  'Which human judgment moments are expensive enough to preserve?',
  'Does the pricing model survive token costs becoming transparent?',
];

const thesisCards = [
  ['01', 'Governed autonomy', 'Agents earn budget when they can be bounded, audited, and interrupted.'],
  ['02', 'Runtime trust', 'The durable product is not the workflow; it is the confidence wrapper around it.'],
  ['03', 'Agency economics', 'The margin pool shifts from labor substitution to accountable outcomes.'],
];
interface FrontPageOptionProps {
  topItems?: NewsItem[];
  archiveItems?: NewsItem[];
  showLiveFeed?: boolean;
  sectionControls?: FrontPageSectionControl[];
}

export function FrontPageOption({
  topItems = [],
  archiveItems = [],
  showLiveFeed = true,
  sectionControls = [],
}: FrontPageOptionProps) {
  const topIntelligence = useMemo(
    () => normalizeIntelligenceItems(showLiveFeed ? topItems : [], { preserveOrder: true }),
    [topItems, showLiveFeed],
  );
  const archiveIntelligence = useMemo(
    // preserveOrder: items arrive sorted by reviewed_at DESC (publish time) —
    // don't re-rank by score or freshly approved items sink down the stream.
    () => normalizeIntelligenceItems(showLiveFeed ? archiveItems : [], { preserveOrder: true }),
    [archiveItems, showLiveFeed],
  );

  return (
    <NewItemsProvider>
      <EditorialLedger
        showLiveFeed={showLiveFeed}
        sectionControls={sectionControls}
        topIntelligence={topIntelligence}
        archiveIntelligence={archiveIntelligence}
      />
    </NewItemsProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0b0b0d] text-neutral-100">
      <div className="border-b border-neutral-800/90 bg-[#0b0b0d]/95">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-6 px-4 py-4 sm:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="grid size-7 place-items-center rounded-md border border-yellow-500/35 bg-yellow-500/10">
              <Image src="/ai_tea_logo.png" alt="" width={22} height={22} className="rounded-sm" />
            </span>
            <span className="truncate font-mono text-[11px] uppercase tracking-[0.34em] text-neutral-300">
              The Tool Printer
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <FavoritesIndicator />
            <Link
              href="/what-is-this"
              className="hidden rounded-md border border-neutral-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-yellow-400/60 hover:text-yellow-200 sm:inline-flex"
            >
              What is this?
            </Link>
            <Link
              href="/about"
              className="hidden rounded-md border border-neutral-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-yellow-400/60 hover:text-yellow-200 sm:inline-flex"
            >
              About the system
            </Link>
            <Link
              href="/report"
              className="hidden rounded-md border border-yellow-500/30 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-yellow-300 transition-colors hover:border-yellow-400 hover:text-yellow-200 sm:inline-flex"
            >
              System report
            </Link>
            <a
              href="https://www.linkedin.com/in/geoffhopkins/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-neutral-800 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100"
            >
              <span className="grid size-4 place-items-center rounded-sm border border-neutral-700 text-[9px] leading-none">
                in
              </span>
              Geoff
            </a>
          </div>
        </div>
      </div>
      {children}
      <PublicFooter />
      <BackToTop />
    </main>
  );
}


function EditorialLedger({
  showLiveFeed,
  sectionControls,
  topIntelligence,
  archiveIntelligence,
}: {
  showLiveFeed: boolean;
  sectionControls: FrontPageSectionControl[];
  topIntelligence: IntelligenceItem[];
  archiveIntelligence: IntelligenceItem[];
}) {
  const isVisible = (key: string) => sectionVisible(sectionControls, key);
  const liveStories = topIntelligence.map(intelligenceToStory);
  const stories = liveStories.length > 0 ? liveStories : topStories;
  const archiveItems = showLiveFeed ? archiveIntelligence : [];
  const [activeStory, setActiveStory] = useState<number | null>(null);
  // Registered by InfiniteArchive so "More news" on the last top story can
  // open the older-stream lightbox directly on the first unviewed item.
  const openArchiveLightboxRef = useRef<(() => void) | null>(null);

  return (
    <Shell>
      <section className="grid min-h-[calc(100vh-64px)] border-b border-neutral-800/90 lg:grid-cols-[1fr_1.26fr_0.74fr]">
        <div className="order-2 flex flex-col justify-between border-t border-neutral-800/90 px-4 py-10 sm:px-8 lg:order-1 lg:border-r lg:border-t-0">
          <div>
            {isVisible('main_thesis') && (
              <>
                <p className="font-mono text-[11px] uppercase tracking-[0.46em] text-yellow-400">The thesis</p>
                <h1 className="mt-8 max-w-3xl text-5xl font-semibold leading-[0.96] tracking-tight text-white sm:text-7xl xl:text-8xl">
                  Agency needs a <span className="font-serif italic text-yellow-300">governance desk.</span>
                </h1>
                <p className="mt-8 max-w-2xl text-lg leading-8 text-neutral-400">
                  AI leaders do not need another feed. They need a front page that separates news,
                  operator lessons, LinkedIn field notes, and board-readable governance arguments.
                </p>
              </>
            )}
            {isVisible('worth_marking') && (
            <div className="mt-9 border-l-2 border-yellow-400 pl-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-yellow-400">Worth marking</p>
              <p className="mt-3 max-w-2xl text-xl font-medium leading-8 text-neutral-100">
                The enterprise winner is the party that can prove where judgment, liability, and
                escalation live after the agent starts acting.
              </p>
              <Link
                href="/blog/agency-needs-a-governance-desk"
                className="mt-6 inline-flex items-center gap-2 rounded-md border border-yellow-300/40 bg-yellow-400 px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-950 shadow-[0_0_32px_rgba(250,204,21,0.18)] transition-colors hover:bg-yellow-300"
              >
                Read the thesis
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
            )}
          </div>
          {isVisible('thesis_cards') && (
          <div className="mt-12 grid gap-3 sm:grid-cols-3">
            {thesisCards.map(([num, title, body]) => (
              <div key={num} className="rounded-md border border-neutral-800 bg-neutral-950/40 p-4">
                <span className="font-mono text-[10px] text-yellow-400">{num}</span>
                <h2 className="mt-4 text-lg font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">{body}</p>
              </div>
            ))}
          </div>
          )}
        </div>
        {isVisible('todays_front_page') && (
        <div className="order-1 px-4 py-10 sm:px-8 lg:order-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.42em] text-yellow-400">
            Today&apos;s front page
          </p>
          <div className="mt-6 space-y-6">
            {stories.map((story, index) => (
              <article
                key={story.title}
                className={`rounded-md border p-6 ${
                  index === 0
                    ? 'border-emerald-400/50 bg-emerald-500/[0.12] shadow-[0_0_28px_rgba(16,185,129,0.10)]'
                    : index === 1
                      ? 'border-red-400/45 bg-red-500/[0.10] shadow-[0_0_28px_rgba(239,68,68,0.08)]'
                      : 'border-yellow-400/45 bg-yellow-500/[0.10] shadow-[0_0_28px_rgba(250,204,21,0.08)]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-500">
                      {story.kicker}
                    </span>
                    <NewBadge createdAt={story.createdAt} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FavoriteToggle item={storyToIntelligence(story)} variant="inline" />
                    <span className="rounded-sm bg-neutral-100 px-2 py-1 font-mono text-[10px] font-bold text-neutral-950">
                      {story.score}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStory(index)}
                  className="mt-5 block max-w-3xl text-left text-3xl font-semibold leading-tight text-white transition-colors hover:text-yellow-200"
                >
                    {story.title}
                </button>
                <p className="mt-3 max-w-3xl text-base leading-7 text-neutral-300">{story.summary}</p>
                <div className="mt-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  <Radio className="size-3.5" />
                  {story.source}
                </div>
              </article>
            ))}
          </div>
          <a
            href="#infinite-older-stream"
            className="mt-8 flex items-center justify-center gap-2 rounded-md border border-neutral-800 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400 transition-colors hover:border-yellow-400/60 hover:text-yellow-200 lg:hidden"
          >
            <ArrowDown className="size-3.5 text-yellow-300" />
            More news below
          </a>
        </div>
        )}
        {isVisible('partner_questions') && (
        <aside className="order-3 border-t border-neutral-800/90 px-4 py-10 sm:px-8 lg:border-l lg:border-t-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.42em] text-yellow-400">
            Partner meeting
          </p>
          <h2 className="mt-5 text-3xl font-semibold leading-tight text-white">
            Four questions every advisory engagement should ask now.
          </h2>
          <div className="mt-8 divide-y divide-neutral-800">
            {questions.map((question, index) => (
              <div key={question} className="py-5">
                <span className="font-mono text-[10px] text-yellow-400">0{index + 1}</span>
                <p className="mt-3 text-lg font-semibold leading-7 text-neutral-100">{question}</p>
              </div>
            ))}
          </div>
        </aside>
        )}
      </section>
      <IntelligenceLightbox
        items={stories.map(storyToIntelligence)}
        activeIndex={activeStory}
        onClose={() => setActiveStory(null)}
        onChange={setActiveStory}
        onEndReached={() => {
          setActiveStory(null);
          if (openArchiveLightboxRef.current) {
            openArchiveLightboxRef.current();
          } else {
            document.getElementById('infinite-older-stream')?.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      />
      {isVisible('infinite_older_stream') && (
        <InfiniteArchive
          archiveItems={archiveItems}
          showButton={isVisible('load_older_button')}
          registerOpenFirstUnviewed={(fn) => {
            openArchiveLightboxRef.current = fn;
          }}
        />
      )}
    </Shell>
  );
}


function NewBadge({ createdAt }: { createdAt?: string | null }) {
  const lastVisit = useLastVisit();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setHydrated(true));
  }, []);

  if (!createdAt || !hydrated) return null;
  const itemIsNew = lastVisit
    ? new Date(createdAt) > new Date(lastVisit)
    : true;
  if (!itemIsNew) return null;

  return (
    <span
      className="inline-flex items-center rounded-sm bg-yellow-400 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-950"
      aria-label="New since your last visit"
    >
      New
    </span>
  );
}

function InfiniteArchive({
  items = [],
  archiveItems,
  showButton = true,
  registerOpenFirstUnviewed,
}: {
  items?: NewsItem[];
  archiveItems?: IntelligenceItem[];
  showButton?: boolean;
  // Lets the parent trigger this section's lightbox (first unviewed item)
  // from the top-stories "More news" handoff.
  registerOpenFirstUnviewed?: (fn: () => void) => void;
}) {
  const liveArchive = archiveItems ?? normalizeIntelligenceItems(items);
  const archive: IntelligenceItem[] = liveArchive.length > 0
    ? liveArchive
    : olderFeed.map((title, index) => ({
        title,
        kind: index % 3 === 0 ? 'LinkedIn' : index % 3 === 1 ? 'News' : 'Paper',
        source: index % 3 === 0 ? 'LinkedIn' : index % 3 === 1 ? 'News' : 'Paper',
        summary: 'Loaded as an older item in the continuous editorial stream, ready for live source wiring.',
        href: null,
      }));

  const [viewedIds, setViewedIds] = useState<Set<string>>(() => new Set());
  const [hideViewed, setHideViewed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let nextViewedIds: Set<string> | null = null;
    let nextHideViewed = false;
    try {
      const storedIds = window.localStorage.getItem(VIEWED_STORAGE_KEY);
      if (storedIds) {
        const parsed = JSON.parse(storedIds);
        if (Array.isArray(parsed)) {
          nextViewedIds = new Set(parsed.filter((id): id is string => typeof id === 'string'));
        }
      }
      const storedHide = window.localStorage.getItem(HIDE_VIEWED_STORAGE_KEY);
      nextHideViewed = storedHide === 'true';
    } catch {
      // localStorage unavailable — fall back to defaults
    }
    queueMicrotask(() => {
      if (nextViewedIds) setViewedIds(nextViewedIds);
      if (nextHideViewed) setHideViewed(true);
      setHydrated(true);
    });
  }, []);

  const markViewed = (id: string | undefined) => {
    if (!id) return;
    setViewedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        window.localStorage.setItem(VIEWED_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleHideViewed = (checked: boolean) => {
    setHideViewed(checked);
    try {
      window.localStorage.setItem(HIDE_VIEWED_STORAGE_KEY, String(checked));
    } catch {
      // ignore
    }
  };

  const displayArchive = hydrated && hideViewed
    ? archive.filter((item) => !(item.id && viewedIds.has(item.id)))
    : archive;
  const [visibleCount, setVisibleCount] = useState(Math.min(16, archive.length));
  useEffect(() => {
    queueMicrotask(() => {
      setVisibleCount((count) => Math.min(Math.max(count, 16), displayArchive.length));
    });
  }, [displayArchive.length]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const visibleArchive = displayArchive.slice(0, visibleCount);

  const openItem = (index: number) => {
    setActiveIndex(index);
    markViewed(visibleArchive[index]?.id);
  };

  const onLightboxChange = (index: number) => {
    setActiveIndex(index);
    markViewed(visibleArchive[index]?.id);
  };

  // "More news" handoff target: open the lightbox on the first item the
  // reader hasn't viewed yet (falling back to the top of the stream), making
  // sure it's within the rendered window first.
  useEffect(() => {
    if (!registerOpenFirstUnviewed) return;
    registerOpenFirstUnviewed(() => {
      if (displayArchive.length === 0) {
        document.getElementById('infinite-older-stream')?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      const firstUnviewed = displayArchive.findIndex(
        (entry) => !(entry.id && viewedIds.has(entry.id)),
      );
      const index = firstUnviewed === -1 ? 0 : firstUnviewed;
      setVisibleCount((count) => Math.max(count, index + 1));
      setActiveIndex(index);
      markViewed(displayArchive[index]?.id);
      document.getElementById('infinite-older-stream')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  return (
    <section id="infinite-older-stream" className="mx-auto max-w-[1800px] px-4 py-10 sm:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-500">
          <ArrowDown className="size-4 text-yellow-300" />
          Infinite older stream
        </div>
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500 hover:text-neutral-200">
            <input
              type="checkbox"
              checked={hideViewed}
              onChange={(event) => toggleHideViewed(event.target.checked)}
              className="size-3 cursor-pointer accent-yellow-400"
            />
            Hide viewed
          </label>
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-600">
            News + LinkedIn + papers
          </span>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {visibleArchive.map((item, index) => {
          const isViewed = hydrated && !!item.id && viewedIds.has(item.id);
          return (
          <article
            key={item.id ?? item.title}
            className={`rounded-md border border-neutral-800 bg-neutral-950/40 p-4 transition-colors hover:border-neutral-600 ${
              isViewed ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-600">
                {item.source}
              </span>
              <div className="flex items-center gap-1">
                <FavoriteToggle item={item} variant="inline" />
                <ArchiveScorePill score={item.score} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => openItem(index)}
              className="mt-4 block text-left text-base font-semibold leading-6 text-neutral-100 hover:text-yellow-200"
            >
              {item.title}
            </button>
            <p className="mt-3 text-sm leading-6 text-neutral-500">
              {item.summary}
            </p>
            {isViewed && (
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.22em] text-neutral-600">
                Already viewed
              </p>
            )}
          </article>
          );
        })}
      </div>
      {showButton && visibleArchive.length > 0 && (
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={() => setVisibleCount((count) => Math.min(count + 16, displayArchive.length))}
          disabled={visibleCount >= displayArchive.length}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-700 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-300 transition-colors hover:border-yellow-400/60 hover:text-yellow-200 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Sparkles className="size-3.5 text-yellow-300" />
          {visibleCount >= displayArchive.length ? 'Archive loaded' : 'Load older intelligence'}
        </button>
      </div>
      )}
      {hydrated && hideViewed && displayArchive.length === 0 && (
        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-600">
          You have viewed every item. Uncheck &ldquo;Hide viewed&rdquo; to browse again.
        </p>
      )}
      <IntelligenceLightbox
        items={displayArchive}
        activeIndex={activeIndex}
        onClose={() => setActiveIndex(null)}
        onChange={onLightboxChange}
      />
    </section>
  );
}

const VIEWED_STORAGE_KEY = 'the-tool-printer-viewed-archive';
const HIDE_VIEWED_STORAGE_KEY = 'the-tool-printer-hide-viewed';

function FavoriteToggle({ item, variant = 'panel' }: { item: IntelligenceItem; variant?: 'panel' | 'inline' }) {
  const { favorites, hydrated, toggle } = useFavorites();
  if (!hydrated || !item.id) return null;
  const liked = isFavoriteId(favorites, item.id);

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    toggle({
      id: item.id!,
      title: item.title,
      source: item.source,
      kind: item.kind,
      score: item.score,
      summary: item.summary,
      href: item.href ?? null,
      createdAt: item.createdAt ?? null,
    });
  };

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={liked}
        aria-label={liked ? 'Unfavorite article' : 'Favorite article'}
        className={`inline-flex items-center rounded-sm p-1 transition-colors ${
          liked ? 'text-rose-300 hover:text-rose-200' : 'text-neutral-600 hover:text-rose-300'
        }`}
      >
        <Heart className="size-3.5" fill={liked ? 'currentColor' : 'none'} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={liked}
      aria-label={liked ? 'Unfavorite article' : 'Favorite article'}
      className={`rounded-md border p-2 transition-colors ${
        liked
          ? 'border-rose-400/60 bg-rose-500/15 text-rose-300 hover:border-rose-300 hover:text-rose-200'
          : 'border-neutral-800 text-neutral-400 hover:border-rose-400/40 hover:text-rose-200'
      }`}
    >
      <Heart className="size-4" fill={liked ? 'currentColor' : 'none'} />
    </button>
  );
}

function ArchiveScorePill({ score }: { score?: string }) {
  if (!score) return null;
  const n = Number(score);
  if (!Number.isFinite(n)) return null;

  let cls = 'bg-neutral-800 text-neutral-400';
  if (n >= 8.5) cls = 'bg-emerald-400 text-neutral-950';
  else if (n >= 7.5) cls = 'bg-emerald-500/40 text-emerald-200';
  else if (n >= 6.5) cls = 'bg-yellow-500/30 text-yellow-200';
  else if (n >= 5) cls = 'bg-neutral-700 text-neutral-200';

  return (
    <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold ${cls}`}>
      {score}
    </span>
  );
}

function IntelligenceLightbox({
  items,
  activeIndex,
  onClose,
  onChange,
  onEndReached,
}: {
  items: IntelligenceItem[];
  activeIndex: number | null;
  onClose: () => void;
  onChange: (index: number) => void;
  // When set, Next on the last item calls this instead of wrapping to the
  // first — used by the top-stories lightbox to hand off into the older
  // stream ("More news").
  onEndReached?: () => void;
}) {
  const { favorites, hydrated: favoritesHydrated, toggle: toggleFavorite } = useFavorites();
  const touchStateRef = useRef({ startX: 0, startY: 0, startT: 0, tracking: false });
  const lastTapRef = useRef(0);
  const [pulseLike, setPulseLike] = useState(false);

  useEffect(() => {
    if (activeIndex === null || !items[activeIndex]) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onChange((activeIndex - 1 + items.length) % items.length);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (activeIndex === items.length - 1 && onEndReached) {
          onEndReached();
        } else {
          onChange((activeIndex + 1) % items.length);
        }
      }
      const href = items[activeIndex]?.href;
      if (event.key === 'Enter' && href) {
        event.preventDefault();
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, items, onChange, onClose, onEndReached]);

  if (activeIndex === null || !items[activeIndex]) return null;
  const item = items[activeIndex];
  const isLast = activeIndex === items.length - 1;
  const previous = () => onChange((activeIndex - 1 + items.length) % items.length);
  const next = () => {
    if (isLast && onEndReached) {
      onEndReached();
      return;
    }
    onChange((activeIndex + 1) % items.length);
  };

  const handleDoubleTapLike = () => {
    if (!favoritesHydrated || !item.id) return;
    toggleFavorite({
      id: item.id,
      title: item.title,
      source: item.source,
      kind: item.kind,
      score: item.score,
      summary: item.summary,
      href: item.href ?? null,
      createdAt: item.createdAt ?? null,
    });
    setPulseLike(true);
    window.setTimeout(() => setPulseLike(false), 450);
  };

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startT: event.timeStamp,
      tracking: true,
    };
  };
  const onTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const state = touchStateRef.current;
    if (!state.tracking) return;
    touchStateRef.current = { ...state, tracking: false };
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - state.startX;
    const dy = touch.clientY - state.startY;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    // Horizontal swipe (≥48px, dominant over vertical) navigates.
    if (adx >= 48 && adx >= ady) {
      lastTapRef.current = 0;
      if (dx < 0) next();
      else previous();
      return;
    }

    // Tap (small movement, short duration): check for double-tap to like.
    if (adx < 12 && ady < 12 && event.timeStamp - state.startT < 350) {
      const target = event.target as HTMLElement | null;
      // Don't hijack taps on actual controls.
      if (target?.closest('button, a, input, label')) {
        lastTapRef.current = 0;
        return;
      }
      const now = event.timeStamp;
      if (now - lastTapRef.current < 320) {
        event.preventDefault();
        handleDoubleTapLike();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
  };

  const liked = favoritesHydrated && item.id ? isFavoriteId(favorites, item.id) : false;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/80 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="w-full max-w-3xl rounded-md border border-neutral-700 bg-[#101012] shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-500">
            <span>{item.kind}</span>
            <span>·</span>
            <span>{activeIndex + 1}/{items.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <FavoriteToggle item={item} />
            <button type="button" onClick={onClose} className="rounded-md border border-neutral-800 p-2 text-neutral-400 hover:text-white" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-sm bg-yellow-400 px-2 py-1 font-mono text-[10px] font-bold text-neutral-950">
                  {item.score ?? 'NOTE'}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  {item.source}
                </span>
              </div>
              <h2 className="mt-5 text-3xl font-semibold leading-tight text-white sm:text-4xl">{item.title}</h2>
              <ScorecardCompact item={item} className="mt-5 lg:hidden" />
            </div>
            <ScorecardPanel item={item} className="hidden lg:block" />
          </div>
          <p className="mt-5 text-base leading-8 text-neutral-300">{item.summary}</p>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="hidden gap-2 sm:flex">
              <button type="button" onClick={previous} className="inline-flex items-center gap-2 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white">
                <ArrowLeft className="size-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={next}
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  isLast && onEndReached
                    ? 'border-yellow-500/50 text-yellow-200 hover:border-yellow-400 hover:text-yellow-100'
                    : 'border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-white'
                }`}
              >
                {isLast && onEndReached ? 'More news' : 'Next'}
                <ArrowRight className="size-4" />
              </button>
            </div>
            {item.href && (
              <a href={item.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-yellow-400 px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-yellow-300">
                Open source
                <ArrowUpRight className="size-4" />
              </a>
            )}
          </div>
          <p className="mt-4 hidden font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600 sm:block">
            Left arrow / right arrow to browse · Enter to open source in a new tab · Esc to close
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600 sm:hidden">
            Swipe ← → to browse · Double-tap to {liked ? 'unlike' : 'like'} · Tap × to close
          </p>
        </div>
      </div>
      {pulseLike && (
        <div className="pointer-events-none fixed inset-0 z-[81] grid place-items-center sm:hidden" aria-hidden>
          <Heart
            className={`size-32 drop-shadow-[0_0_24px_rgba(244,63,94,0.55)] ${liked ? 'text-rose-400' : 'text-neutral-200'}`}
            fill={liked ? 'currentColor' : 'none'}
            style={{ animation: 'tp-like-pop 450ms ease-out' }}
          />
          <style>{`@keyframes tp-like-pop { 0% { opacity: 0; transform: scale(0.6); } 30% { opacity: 1; transform: scale(1.15); } 100% { opacity: 0; transform: scale(1); } }`}</style>
        </div>
      )}
    </div>
  );
}

function ScorecardCompact({ item, className = '' }: { item: IntelligenceItem; className?: string }) {
  const rows = scorecardRows(item.scorecard);
  if (!item.score && rows.length === 0) return null;

  const totalWeight = rows.reduce((sum, [, , w]) => sum + w, 0) || 1;
  const ratio = rows.length > 0
    ? rows.reduce((sum, [, value, weight]) => sum + (Number(value) / 10) * weight, 0) / totalWeight
    : 0;
  const top = [...rows].sort((a, b) => Number(b[1]) * b[2] - Number(a[1]) * a[2]).slice(0, 3);

  return (
    <aside className={`rounded-md border border-neutral-800 bg-neutral-950/50 px-3 py-2 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500">Score</span>
        <span className="font-mono text-base font-bold text-yellow-300">{item.score ?? 'N/A'}</span>
        <div className="ml-auto h-1.5 flex-1 max-w-[160px] overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-yellow-400"
            style={{ width: `${Math.max(4, Math.min(100, ratio * 100))}%` }}
          />
        </div>
      </div>
      {top.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-500">
          {top.map(([label, value]) => (
            <span key={label}>
              {label} <span className="text-neutral-300">{Number(value).toFixed(1)}</span>
            </span>
          ))}
        </div>
      )}
    </aside>
  );
}

function ScorecardPanel({ item, className = '' }: { item: IntelligenceItem; className?: string }) {
  const rows = scorecardRows(item.scorecard);

  return (
    <aside className={`rounded-md border border-neutral-800 bg-neutral-950/50 p-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500">Weighted score</p>
        <span className="font-mono text-lg font-bold text-yellow-300">{item.score ?? 'N/A'}</span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-neutral-600">No score breakdown available.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map(([label, value, weight]) => (
            <div key={label}>
              <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                <span>
                  {label}
                  <span className="ml-1 text-neutral-600">×{weight}</span>
                </span>
                <span>{Number(value).toFixed(1)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-yellow-400"
                  style={{ width: `${Math.max(4, Math.min(100, Number(value) * 10))}%` }}
                />
              </div>
            </div>
          ))}
          <p className="pt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-neutral-600">
            Weighted by editorial scorecard, not a plain average.
          </p>
        </div>
      )}
    </aside>
  );
}

function normalizeIntelligenceItems(
  items: NewsItem[],
  { preserveOrder = false }: { preserveOrder?: boolean } = {},
): IntelligenceItem[] {
  const decorated = items.map((item) => ({ item, displayScore: getDisplayScore(item) }));
  const ranked = preserveOrder
    ? decorated
    : decorated.sort((a, b) => {
        const aScore = a.displayScore ?? -Infinity;
        const bScore = b.displayScore ?? -Infinity;
        if (aScore !== bScore) return bScore - aScore;
        return new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime();
      });

  return ranked.map(({ item, displayScore }) => ({
    id: item.id,
    title: decodeHtmlEntities(item.title),
    source: decodeHtmlEntities(item.source_name ?? item.source_type),
    kind: item.source_type === 'twitter' ? 'LinkedIn/X' : item.source_type === 'youtube' ? 'Video' : item.source_type,
    score: displayScore !== null ? displayScore.toFixed(1) : undefined,
    scorecard: item.score_breakdown,
    summary: decodeHtmlEntities(item.summary ?? item.source_name ?? 'Approved live item from the intelligence queue.'),
    href: item.url,
    createdAt: item.created_at,
  }));
}

function intelligenceToStory(item: IntelligenceItem) {
  return {
    id: item.id,
    kicker: item.kind,
    title: item.title,
    source: item.source,
    score: item.score ?? 'N/A',
    summary: item.summary,
    href: item.href ?? undefined,
    createdAt: item.createdAt ?? null,
    scorecard: item.scorecard ?? null,
  } satisfies EditorialStory;
}

function storyToIntelligence(story: EditorialStory): IntelligenceItem {
  return {
    id: story.id,
    title: story.title,
    source: story.source,
    kind: story.kicker,
    score: story.score,
    scorecard: story.scorecard ?? null,
    summary: story.summary,
    href: story.href,
    createdAt: story.createdAt ?? null,
  };
}

const SCORECARD_DIMENSIONS: Array<[label: string, key: string, weight: number]> = [
  ['relevance', 'relevance', 18],
  ['recency', 'recency', 14],
  ['novelty', 'novelty', 12],
  ['evidence', 'evidence', 12],
  ['governance', 'governanceFit', 12],
  ['operator', 'operatorUsefulness', 10],
  ['source', 'sourceQuality', 8],
  ['clarity', 'clarity', 6],
  ['distinct', 'distinctiveness', 5],
  ['risk', 'riskAwareness', 3],
];

function scorecardRows(scorecard: Record<string, unknown> | null | undefined) {
  if (!scorecard) return [];
  return SCORECARD_DIMENSIONS
    .map(([label, key, weight]) => [label, scorecard[key], weight] as const)
    .filter(([, value]) => typeof value === 'number') as Array<readonly [string, number, number]>;
}

function sectionVisible(sections: FrontPageSectionControl[], key: string) {
  const section = sections.find((item) => item.key === key);
  return section ? section.visible : true;
}
