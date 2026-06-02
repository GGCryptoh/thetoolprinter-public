export type SourceType = 'rss' | 'youtube' | 'twitter' | 'github' | 'linkedin';
export type ItemStatus = 'pending' | 'approved' | 'rejected';
export type Section = 'trending' | 'signals';
export type WorkflowStatus = 'running' | 'stopping' | 'completed' | 'failed' | 'cancelled';
export type IngestEventLevel = 'info' | 'success' | 'warning' | 'error';

export interface NewsItem {
  id: string;
  title: string;
  source_type: SourceType;
  source_name: string | null;
  url: string;
  image_url: string | null;
  summary: string | null;
  score: number | null;
  score_breakdown: {
    novelty: number;
    impact: number;
    relevance: number;
    recency?: number;
    evidence?: number;
    governanceFit?: number;
    operatorUsefulness?: number;
    sourceQuality?: number;
    clarity?: number;
    distinctiveness?: number;
    riskAwareness?: number;
    qualityScore?: number;
    qualityReason?: string;
  } | null;
  status: ItemStatus;
  section: Section | null;
  tags: string[];
  raw_metadata: Record<string, unknown>;
  created_at: string;
  scored_at: string | null;
  reviewed_at: string | null;
  archived_at: string | null;
}

export interface Feed {
  id: string;
  type: SourceType;
  name: string;
  url: string;
  config: Record<string, unknown>;
  active: boolean;
  last_fetched_at: string | null;
  created_at: string;
}

export interface Prompt {
  id: string;
  type: string;
  version: number;
  content: string;
  active: boolean;
  created_at: string;
}

export interface WorkflowRun {
  id: string;
  workflow_run_id: string | null;
  status: WorkflowStatus;
  items_fetched: number;
  items_scored: number;
  errors: unknown[];
  started_at: string;
  completed_at: string | null;
}

export interface IngestEvent {
  id: string;
  workflow_run_id: string | null;
  step: string;
  level: IngestEventLevel;
  message: string;
  source_type: SourceType | null;
  source_name: string | null;
  item_id: string | null;
  metrics: Record<string, unknown>;
  created_at: string;
}

export interface NewNewsItem {
  title: string;
  source_type: SourceType;
  source_name: string | null;
  url: string;
  image_url?: string | null;
  summary?: string | null;
  raw_metadata?: Record<string, unknown>;
}
