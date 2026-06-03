import { createServiceClient } from '@/lib/supabase/server';
import type { NewsItem } from '@/lib/supabase/types';

export interface FrontPageController {
  visible: boolean;
  aiUpdatesEnabled: boolean;
  scheduleEvery: number;
  scheduleUnit: 'hours' | 'days' | 'weeks';
  // 'interval' = simple every-N-units cadence (scheduleEvery/scheduleUnit).
  // 'business' = timezone-aware window: every N hours on weekdays within a
  // daytime window, and a separate (usually slower) weekend cadence.
  scheduleMode: 'interval' | 'business';
  scheduleTimezone: string;
  businessStartHour: number;
  businessEndHour: number;
  weekdayEveryHours: number;
  weekendEveryHours: number; // 0 disables weekend runs entirely
  articleCount: number;
  scoreLimitPerRun: number;
  promptType: string;
  qualityPromptType: string;
  previewEnabled: boolean;
  publishingGateMode: 'human' | 'hybrid' | 'automatic';
  autoApproveThreshold: number;
  autoRejectThreshold: number;
  maxAutoApprovedPerRun: number;
  rejectedRetentionDays: number;
}

export interface QualityDimension {
  key: string;
  label: string;
  weight: number;
  description: string;
}

export interface FrontPageSectionControl {
  key: string;
  label: string;
  currentSurface: string;
  liveSource: string;
  visible: boolean;
  aiUpdatesEnabled: boolean;
  scheduleEvery: number;
  scheduleUnit: 'hours' | 'days' | 'weeks';
  articleCount: number;
  prompt: string;
}

// Top "Today's front page" stories pick the most recent approved items
// reviewed within this window (newest first, score as tiebreak). If fewer
// than 3 qualify, older approved items fill the gap. Older fresh items roll
// into the archive grid below.
export const TOP_STORIES_FRESHNESS_HOURS = 72;
export const TOP_STORIES_COUNT = 3;

export const DEFAULT_FRONT_PAGE_CONTROLLER: FrontPageController = {
  visible: true,
  aiUpdatesEnabled: true,
  scheduleEvery: 4,
  scheduleUnit: 'hours',
  scheduleMode: 'interval',
  scheduleTimezone: 'America/New_York',
  businessStartHour: 8,
  businessEndHour: 20,
  weekdayEveryHours: 4,
  weekendEveryHours: 24,
  articleCount: 12,
  scoreLimitPerRun: 50,
  promptType: 'front_page_generation',
  qualityPromptType: 'quality_manager',
  previewEnabled: true,
  publishingGateMode: 'hybrid',
  autoApproveThreshold: 8.5,
  autoRejectThreshold: 4,
  maxAutoApprovedPerRun: 3,
  rejectedRetentionDays: 0,
};

export const DEFAULT_FRONT_PAGE_PROMPT = `You are the editorial agent for The Tool Printer.

Goal: find and summarize the highest-signal AI, agency, governance, identity, trust, and enterprise automation developments for an executive audience.

Return only items that help a reader make a decision. Reject generic launch posts, SEO filler, stale commentary, and AI slop.

Prioritize:
- AI agents in real enterprise workflows
- identity, authentication, trust, and verification
- governance, auditability, provenance, and liability
- Microsoft 365 / workplace agent patterns
- LinkedIn/operator field notes with practical signal
- research or technical changes with near-term business implications

Write in Geoff Hopkins' style: direct, commercially literate, skeptical of hype, useful to advisory and technology consulting leaders.`;

export const DEFAULT_QUALITY_MANAGER_PROMPT = `You are the Quality Manager Agent for The Tool Printer.

Score each candidate article as an editorial asset, not just as news. A good item should be recent, relevant, evidence-backed, decision-useful, clear, non-generic, and connected to AI agency/governance.

Return a weighted scorecard and a short reason for approval or rejection. Penalize thin summaries, repeated stories, unverified claims, shallow vendor announcements, and content that sounds plausible but has no operational consequence.`;

export const DEFAULT_QUALITY_DIMENSIONS: QualityDimension[] = [
  {
    key: 'relevance',
    label: 'Relevance',
    weight: 18,
    description: 'Fit to AI agency, governance, trust, identity, and enterprise operator concerns.',
  },
  {
    key: 'recency',
    label: 'Recency',
    weight: 14,
    description: 'Freshness of the underlying source, with stale items penalized heavily.',
  },
  {
    key: 'novelty',
    label: 'Novelty',
    weight: 12,
    description: 'Whether the item adds something meaningfully new instead of repeating the cycle.',
  },
  {
    key: 'evidence',
    label: 'Evidence',
    weight: 12,
    description: 'Concrete facts, source quality, dates, named entities, demos, numbers, or primary material.',
  },
  {
    key: 'governanceFit',
    label: 'Governance Fit',
    weight: 12,
    description: 'Connection to authority, auditability, liability, provenance, trust, and controls.',
  },
  {
    key: 'operatorUsefulness',
    label: 'Operator Usefulness',
    weight: 10,
    description: 'Helps a builder, consultant, or leader make a better decision.',
  },
  {
    key: 'sourceQuality',
    label: 'Source Quality',
    weight: 8,
    description: 'Credibility of the source and whether the URL can support the summary.',
  },
  {
    key: 'clarity',
    label: 'Clarity',
    weight: 6,
    description: 'Can be explained cleanly without fake certainty or buzzword fog.',
  },
  {
    key: 'distinctiveness',
    label: 'Distinctiveness',
    weight: 5,
    description: 'Does not feel like the same AI post everyone else is publishing.',
  },
  {
    key: 'riskAwareness',
    label: 'Risk Awareness',
    weight: 3,
    description: 'Acknowledges limitations, failure modes, regulation, or implementation risk.',
  },
];

export const DEFAULT_FRONT_PAGE_SECTIONS: FrontPageSectionControl[] = [
  {
    key: 'top_nav_brand',
    label: 'Top nav / brand',
    currentSurface: 'The Tool Printer, option links, Geoff LinkedIn',
    liveSource: 'Static site config',
    visible: true,
    aiUpdatesEnabled: false,
    scheduleEvery: 30,
    scheduleUnit: 'days',
    articleCount: 1,
    prompt: 'Maintain the brand/navigation surface. Keep it concise, premium, and stable unless the product positioning changes.',
  },
  {
    key: 'main_thesis',
    label: 'Main thesis + thesis explainer',
    currentSurface: 'Agency needs a governance desk, plus the core explanation of why leaders need governed AI output.',
    liveSource: 'Editorial positioning / about copy',
    visible: true,
    aiUpdatesEnabled: false,
    scheduleEvery: 7,
    scheduleUnit: 'days',
    articleCount: 1,
    prompt: 'Refine the main thesis and supporting explainer in Geoff Hopkins style: direct, executive, skeptical of AI slop, and anchored in governance.',
  },
  {
    key: 'worth_marking',
    label: 'Worth marking block',
    currentSurface: 'Core market argument about judgment, liability, and escalation.',
    liveSource: 'Featured editorial thesis',
    visible: true,
    aiUpdatesEnabled: false,
    scheduleEvery: 7,
    scheduleUnit: 'days',
    articleCount: 1,
    prompt: 'Write a single sharp market argument worth marking. It should feel board-readable and commercially useful.',
  },
  {
    key: 'thesis_cards',
    label: 'Three thesis cards',
    currentSurface: 'Governed autonomy, runtime trust, agency economics.',
    liveSource: 'Editable knowledge blocks',
    visible: true,
    aiUpdatesEnabled: false,
    scheduleEvery: 14,
    scheduleUnit: 'days',
    articleCount: 3,
    prompt: 'Maintain three concise thesis cards that explain the strategic pillars of governed AI agency.',
  },
  {
    key: 'todays_front_page',
    label: 'Today’s front page',
    currentSurface: 'Three featured AI/governance stories.',
    liveSource: 'Approved/scored aitea_news_items',
    visible: true,
    aiUpdatesEnabled: true,
    scheduleEvery: 4,
    scheduleUnit: 'hours',
    articleCount: 3,
    prompt: 'Select the three highest-signal approved items for the front page. Prioritize agency, governance, trust, identity, verification, and operator usefulness.',
  },
  {
    key: 'story_scores',
    label: 'Story scores',
    currentSurface: 'Example scores like 9.7, 9.3, 8.9.',
    liveSource: 'AI scoring pipeline',
    visible: true,
    aiUpdatesEnabled: false,
    scheduleEvery: 4,
    scheduleUnit: 'hours',
    articleCount: 3,
    prompt: 'Expose score rationale clearly. Scores should reflect relevance, recency, novelty, evidence, governance fit, and operator usefulness.',
  },
  {
    key: 'partner_questions',
    label: 'Partner meeting questions',
    currentSurface: 'Four advisory/governance questions.',
    liveSource: 'Curated editorial prompts',
    visible: true,
    aiUpdatesEnabled: false,
    scheduleEvery: 1,
    scheduleUnit: 'days',
    articleCount: 4,
    prompt: 'Generate four questions an advisory partner should ask clients about AI agency, governance, liability, controls, and trust.',
  },
  {
    key: 'about_system',
    label: 'About the system',
    currentSurface: 'Automated newsletter/intelligence loop explanation.',
    liveSource: 'Static about / positioning copy',
    visible: true,
    aiUpdatesEnabled: false,
    scheduleEvery: 30,
    scheduleUnit: 'days',
    articleCount: 1,
    prompt: 'Explain The Tool Printer as an automated intelligence loop with retroactive human governance and anti-slop quality control.',
  },
  {
    key: 'cadence_block',
    label: 'Cadence block',
    currentSurface: 'Explains the hourly clock tick and controller-gated ingest cadence.',
    liveSource: 'vercel.json / admin ingestion config',
    visible: true,
    aiUpdatesEnabled: false,
    scheduleEvery: 4,
    scheduleUnit: 'hours',
    articleCount: 1,
    prompt: 'Keep cadence language accurate and plain. Explain what runs automatically and what admins control manually.',
  },
  {
    key: 'operating_loop_cards',
    label: 'Operating loop cards',
    currentSurface: 'Signal capture, agent drafting, performance loops, human governance.',
    liveSource: 'Product narrative / docs',
    visible: true,
    aiUpdatesEnabled: false,
    scheduleEvery: 14,
    scheduleUnit: 'days',
    articleCount: 4,
    prompt: 'Maintain the operating loop cards. Make the automation/governance model legible to executives.',
  },
  {
    key: 'infinite_older_stream',
    label: 'Infinite older stream',
    currentSurface: 'Older news, LinkedIn, paper items.',
    liveSource: 'Paginated older aitea_news_items, LinkedIn posts, paper/feed items',
    visible: true,
    aiUpdatesEnabled: false,
    scheduleEvery: 4,
    scheduleUnit: 'hours',
    articleCount: 12,
    prompt: 'Select older approved intelligence items for infinite scroll. Avoid repeats and keep the archive useful.',
  },
  {
    key: 'load_older_button',
    label: 'Load older intelligence button',
    currentSurface: 'Visual placeholder.',
    liveSource: 'Future infinite scroll / pagination action',
    visible: true,
    aiUpdatesEnabled: false,
    scheduleEvery: 30,
    scheduleUnit: 'days',
    articleCount: 1,
    prompt: 'Keep the load-more control clear and restrained. Do not add explanatory feature copy in the UI.',
  },
];


export function normalizeController(value: unknown): FrontPageController {
  const raw = value && typeof value === 'object' ? value as Partial<FrontPageController> : {};
  const scheduleUnit =
    raw.scheduleUnit === 'days' || raw.scheduleUnit === 'weeks' || raw.scheduleUnit === 'hours'
      ? raw.scheduleUnit
      : DEFAULT_FRONT_PAGE_CONTROLLER.scheduleUnit;
  const publishingGateMode =
    raw.publishingGateMode === 'human' || raw.publishingGateMode === 'hybrid' || raw.publishingGateMode === 'automatic'
      ? raw.publishingGateMode
      : DEFAULT_FRONT_PAGE_CONTROLLER.publishingGateMode;
  const scheduleMode =
    raw.scheduleMode === 'business' || raw.scheduleMode === 'interval'
      ? raw.scheduleMode
      : DEFAULT_FRONT_PAGE_CONTROLLER.scheduleMode;
  const scheduleTimezone = isValidTimezone(raw.scheduleTimezone)
    ? (raw.scheduleTimezone as string)
    : DEFAULT_FRONT_PAGE_CONTROLLER.scheduleTimezone;

  return {
    visible: typeof raw.visible === 'boolean' ? raw.visible : DEFAULT_FRONT_PAGE_CONTROLLER.visible,
    aiUpdatesEnabled:
      typeof raw.aiUpdatesEnabled === 'boolean'
        ? raw.aiUpdatesEnabled
        : DEFAULT_FRONT_PAGE_CONTROLLER.aiUpdatesEnabled,
    scheduleEvery: clampInt(raw.scheduleEvery, 1, 52, DEFAULT_FRONT_PAGE_CONTROLLER.scheduleEvery),
    scheduleUnit,
    scheduleMode,
    scheduleTimezone,
    businessStartHour: clampInt(raw.businessStartHour, 0, 23, DEFAULT_FRONT_PAGE_CONTROLLER.businessStartHour),
    businessEndHour: clampInt(raw.businessEndHour, 1, 24, DEFAULT_FRONT_PAGE_CONTROLLER.businessEndHour),
    weekdayEveryHours: clampInt(raw.weekdayEveryHours, 1, 24, DEFAULT_FRONT_PAGE_CONTROLLER.weekdayEveryHours),
    weekendEveryHours: clampInt(raw.weekendEveryHours, 0, 168, DEFAULT_FRONT_PAGE_CONTROLLER.weekendEveryHours),
    articleCount: clampInt(raw.articleCount, 1, 50, DEFAULT_FRONT_PAGE_CONTROLLER.articleCount),
    scoreLimitPerRun: clampInt(raw.scoreLimitPerRun, 1, 500, DEFAULT_FRONT_PAGE_CONTROLLER.scoreLimitPerRun),
    promptType: raw.promptType || DEFAULT_FRONT_PAGE_CONTROLLER.promptType,
    qualityPromptType: raw.qualityPromptType || DEFAULT_FRONT_PAGE_CONTROLLER.qualityPromptType,
    previewEnabled:
      typeof raw.previewEnabled === 'boolean'
        ? raw.previewEnabled
        : DEFAULT_FRONT_PAGE_CONTROLLER.previewEnabled,
    publishingGateMode,
    autoApproveThreshold: clampNumber(raw.autoApproveThreshold, 0, 10, DEFAULT_FRONT_PAGE_CONTROLLER.autoApproveThreshold),
    autoRejectThreshold: clampNumber(raw.autoRejectThreshold, 0, 10, DEFAULT_FRONT_PAGE_CONTROLLER.autoRejectThreshold),
    maxAutoApprovedPerRun: clampInt(raw.maxAutoApprovedPerRun, 0, 50, DEFAULT_FRONT_PAGE_CONTROLLER.maxAutoApprovedPerRun),
    rejectedRetentionDays: clampInt(raw.rejectedRetentionDays, 0, 3650, DEFAULT_FRONT_PAGE_CONTROLLER.rejectedRetentionDays),
  };
}

export function normalizeQualityDimensions(value: unknown): QualityDimension[] {
  if (!Array.isArray(value)) return DEFAULT_QUALITY_DIMENSIONS;
  const dimensions = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Partial<QualityDimension>;
      if (!raw.key || !raw.label) return null;
      return {
        key: String(raw.key),
        label: String(raw.label),
        weight: clampInt(raw.weight, 0, 100, 0),
        description: String(raw.description ?? ''),
      };
    })
    .filter((item): item is QualityDimension => item !== null);

  return dimensions.length > 0 ? dimensions : DEFAULT_QUALITY_DIMENSIONS;
}

export function normalizeFrontPageSections(value: unknown): FrontPageSectionControl[] {
  const rows = Array.isArray(value) ? value as Array<Partial<FrontPageSectionControl>> : [];

  return DEFAULT_FRONT_PAGE_SECTIONS.map((section) => {
    const saved = rows.find((row) => row.key === section.key);
    if (!saved) return section;
    const scheduleUnit =
      saved.scheduleUnit === 'days' || saved.scheduleUnit === 'weeks' || saved.scheduleUnit === 'hours'
        ? saved.scheduleUnit
        : section.scheduleUnit;

    return {
      ...section,
      currentSurface: String(saved.currentSurface ?? section.currentSurface),
      liveSource: String(saved.liveSource ?? section.liveSource),
      visible: typeof saved.visible === 'boolean' ? saved.visible : section.visible,
      aiUpdatesEnabled:
        typeof saved.aiUpdatesEnabled === 'boolean'
          ? saved.aiUpdatesEnabled
          : section.aiUpdatesEnabled,
      scheduleEvery: clampInt(saved.scheduleEvery, 1, 52, section.scheduleEvery),
      scheduleUnit,
      articleCount: clampInt(saved.articleCount, 1, 50, section.articleCount),
      prompt: String(saved.prompt ?? section.prompt),
    };
  });
}

export async function getFrontPageController() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('aitea_knowledge_blocks')
    .select('content_json')
    .eq('category', 'front_page_controller')
    .maybeSingle();

  return normalizeController(data?.content_json);
}

export async function getQualityDimensions() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('aitea_knowledge_blocks')
    .select('content_json')
    .eq('category', 'quality_manager_scorecard')
    .maybeSingle();

  return normalizeQualityDimensions(data?.content_json);
}

export async function getFrontPageSections() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('aitea_knowledge_blocks')
    .select('content_json')
    .eq('category', 'front_page_sections')
    .maybeSingle();

  return normalizeFrontPageSections(data?.content_json);
}

export async function getActivePrompt(type: string, fallback: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('aitea_prompts')
    .select('id, type, version, content, active, created_at')
    .eq('type', type)
    .eq('active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? {
    id: 'fallback',
    type,
    version: 0,
    content: fallback,
    active: true,
    created_at: new Date(0).toISOString(),
  };
}

export async function getFrontPageItems(limit: number) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('aitea_news_items')
    .select('id, title, source_type, source_name, url, image_url, summary, score, score_breakdown, status, section, tags, raw_metadata, created_at, scored_at, reviewed_at')
    .eq('status', 'approved')
    .not('score', 'is', null)
    .order('created_at', { ascending: false })
    .order('score', { ascending: false })
    .limit(limit);

  return (data ?? []) as NewsItem[];
}

export function partitionFrontPageItems(
  items: NewsItem[],
  topN: number = TOP_STORIES_COUNT,
  freshnessHours: number = TOP_STORIES_FRESHNESS_HOURS,
) {
  const cutoff = Date.now() - freshnessHours * 3600 * 1000;
  const stampOf = (item: NewsItem) => {
    const reviewed = item.reviewed_at ? new Date(item.reviewed_at).getTime() : NaN;
    if (Number.isFinite(reviewed)) return reviewed;
    return item.created_at ? new Date(item.created_at).getTime() : 0;
  };

  // Items arrive pre-sorted by created_at DESC, so slicing the
  // freshness-filtered list keeps the newest approvals on top.
  const fresh = items.filter((item) => stampOf(item) >= cutoff);
  const top = fresh.slice(0, topN);

  if (top.length < topN) {
    const seen = new Set(top.map((item) => item.id));
    for (const item of items) {
      if (top.length >= topN) break;
      if (seen.has(item.id)) continue;
      top.push(item);
      seen.add(item.id);
    }
  }

  const topIds = new Set(top.map((item) => item.id));
  const rest = items.filter((item) => !topIds.has(item.id));
  return { top, rest };
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function isValidTimezone(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
