-- The Tool Printer — authoritative database schema
-- Generated from the live Supabase instance (introspected, not hand-written).
-- Apply this in the Supabase SQL editor (or via `psql`) on a fresh project,
-- then run seed.sql for starter content.
--
-- Safe to re-run: every statement is idempotent.
-- All tables are prefixed `aitea_` and have RLS enabled. The web app reads with
-- the anon key (subject to the public policies below) and writes with the
-- service-role key (which bypasses RLS).

begin;

-- Supabase Vault — required by the AI provider key functions at the bottom.
create extension if not exists supabase_vault with schema vault;

-- ---------------------------------------------------------------------------
-- aitea_news_items — primary content table (all ingested items, all sources)
-- ---------------------------------------------------------------------------
create table if not exists public.aitea_news_items (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  source_type     text not null,
  source_name     text,
  url             text not null,
  image_url       text,
  summary         text,
  score           numeric(4,2),
  score_breakdown jsonb,
  status          text not null default 'pending',
  section         text,
  tags            text[] default '{}'::text[],
  raw_metadata    jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  scored_at       timestamptz,
  reviewed_at     timestamptz,
  archived_at     timestamptz,
  constraint aitea_news_items_url_key unique (url),
  constraint aitea_news_items_source_type_check
    check (source_type = any (array['rss','youtube','twitter','github','linkedin'])),
  constraint aitea_news_items_status_check
    check (status = any (array['pending','approved','rejected'])),
  constraint aitea_news_items_section_check
    check (section = any (array['trending','signals']) or section is null),
  constraint aitea_news_items_score_check
    check (score >= 0 and score <= 10)
);

create index if not exists idx_aitea_news_items_status     on public.aitea_news_items (status);
create index if not exists idx_aitea_news_items_section    on public.aitea_news_items (section);
create index if not exists idx_aitea_news_items_score      on public.aitea_news_items (score);
create index if not exists idx_aitea_news_items_created_at on public.aitea_news_items (created_at desc);
create index if not exists aitea_news_items_archived_at_idx on public.aitea_news_items (archived_at);
create index if not exists aitea_news_items_status_active_idx
  on public.aitea_news_items (status) where (archived_at is null);

-- ---------------------------------------------------------------------------
-- aitea_feeds — configured data sources, managed via /admin/feeds
-- ---------------------------------------------------------------------------
create table if not exists public.aitea_feeds (
  id              uuid primary key default gen_random_uuid(),
  type            text not null,
  name            text not null,
  url             text not null,
  config          jsonb default '{}'::jsonb,
  active          boolean not null default true,
  last_fetched_at timestamptz,
  created_at      timestamptz not null default now(),
  constraint aitea_feeds_type_check
    check (type = any (array['rss','youtube','twitter','github','linkedin']))
);

-- ---------------------------------------------------------------------------
-- aitea_knowledge_blocks — editable knowledge sections + control config rows.
-- Note: rows `front_page_controller` and `ingest_control` store operational
-- config as JSON, not reader-facing content.
-- ---------------------------------------------------------------------------
create table if not exists public.aitea_knowledge_blocks (
  id           uuid primary key default gen_random_uuid(),
  category     text not null,
  title        text not null,
  content_json jsonb not null default '[]'::jsonb,
  sort_order   integer not null default 0,
  updated_at   timestamptz not null default now(),
  constraint aitea_knowledge_blocks_category_key unique (category)
);

-- ---------------------------------------------------------------------------
-- aitea_people — curated people to follow
-- ---------------------------------------------------------------------------
create table if not exists public.aitea_people (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  handle      text not null,
  avatar_url  text,
  description text,
  tags        text[] default '{}'::text[],
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  url         text,
  sources     text[] default '{}'::text[]
);

-- ---------------------------------------------------------------------------
-- aitea_prompts — versioned scoring prompt templates (server-side only)
-- ---------------------------------------------------------------------------
create table if not exists public.aitea_prompts (
  id         uuid primary key default gen_random_uuid(),
  type       text not null,
  version    integer not null default 1,
  content    text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  constraint aitea_prompts_type_version_key unique (type, version)
);

-- ---------------------------------------------------------------------------
-- aitea_workflow_runs — pipeline execution log (admin-only)
-- ---------------------------------------------------------------------------
create table if not exists public.aitea_workflow_runs (
  id              uuid primary key default gen_random_uuid(),
  workflow_run_id text,
  status          text not null default 'running',
  items_fetched   integer not null default 0,
  items_scored    integer not null default 0,
  errors          jsonb default '[]'::jsonb,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  constraint aitea_workflow_runs_status_check
    check (status = any (array['running','completed','failed']))
);

-- ---------------------------------------------------------------------------
-- aitea_ingest_events — append-only telemetry for the live surveillance page
-- ---------------------------------------------------------------------------
create table if not exists public.aitea_ingest_events (
  id              uuid primary key default gen_random_uuid(),
  workflow_run_id text,
  step            text not null,
  level           text not null default 'info',
  message         text not null,
  source_type     text,
  source_name     text,
  item_id         uuid references public.aitea_news_items(id) on delete set null,
  metrics         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint aitea_ingest_events_level_check
    check (level = any (array['info','success','warning','error']))
);

create index if not exists idx_aitea_ingest_events_created_at
  on public.aitea_ingest_events (created_at desc);
create index if not exists idx_aitea_ingest_events_step
  on public.aitea_ingest_events (step);
create index if not exists idx_aitea_ingest_events_workflow_run_id
  on public.aitea_ingest_events (workflow_run_id, created_at desc);

-- ---------------------------------------------------------------------------
-- aitea_ai_provider_configs — AI provider selection; key stored in Vault
-- ---------------------------------------------------------------------------
create table if not exists public.aitea_ai_provider_configs (
  provider          text primary key,
  vault_secret_id   uuid,
  selected_model    text,
  active_for_scoring boolean not null default false,
  model_catalog     jsonb not null default '[]'::jsonb,
  last_checked_at   timestamptz,
  updated_at        timestamptz not null default now(),
  constraint aitea_ai_provider_configs_provider_check
    check (provider = any (array['openai','anthropic','deepseek']))
);

-- ---------------------------------------------------------------------------
-- aitea_people_stats — scraped follower/engagement stats per person
-- ---------------------------------------------------------------------------
create table if not exists public.aitea_people_stats (
  id             uuid primary key default gen_random_uuid(),
  person_id      uuid references public.aitea_people(id) on delete cascade,
  followers      integer,
  following      integer,
  posts_count    integer,
  avg_engagement numeric,
  scraped_at     timestamptz default now(),
  raw_data       jsonb
);

create index if not exists idx_people_stats_person
  on public.aitea_people_stats (person_id, scraped_at desc);

-- ---------------------------------------------------------------------------
-- aitea_activity_log — admin/system action log
-- ---------------------------------------------------------------------------
create table if not exists public.aitea_activity_log (
  id         uuid primary key default gen_random_uuid(),
  action     text not null,
  detail     text,
  metadata   jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- aitea_daily_metrics — rolled-up daily counters for /admin/financials
-- ---------------------------------------------------------------------------
create table if not exists public.aitea_daily_metrics (
  id             uuid primary key default gen_random_uuid(),
  date           date not null,
  items_fetched  integer default 0,
  items_scored   integer default 0,
  items_approved integer default 0,
  items_rejected integer default 0,
  ai_tokens_used integer default 0,
  ai_cost_cents  integer default 0,
  workflow_runs  integer default 0,
  feeds_active   integer default 0,
  created_at     timestamptz default now(),
  constraint aitea_daily_metrics_date_key unique (date)
);

-- ---------------------------------------------------------------------------
-- aitea_app_config — singleton key/value store for app-level state:
-- the first-run setup flag and the hashed admin password.
-- ---------------------------------------------------------------------------
create table if not exists public.aitea_app_config (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.aitea_news_items        enable row level security;
alter table public.aitea_feeds             enable row level security;
alter table public.aitea_knowledge_blocks  enable row level security;
alter table public.aitea_people            enable row level security;
alter table public.aitea_prompts           enable row level security;
alter table public.aitea_workflow_runs     enable row level security;
alter table public.aitea_ingest_events     enable row level security;
alter table public.aitea_ai_provider_configs enable row level security;
alter table public.aitea_people_stats      enable row level security;
alter table public.aitea_activity_log      enable row level security;
alter table public.aitea_daily_metrics     enable row level security;
alter table public.aitea_app_config        enable row level security;

-- Public read policies (anon key). Writes always go through the service role.
drop policy if exists "Public read approved items" on public.aitea_news_items;
create policy "Public read approved items" on public.aitea_news_items
  for select using (status = 'approved');

drop policy if exists "Public read active feeds" on public.aitea_feeds;
create policy "Public read active feeds" on public.aitea_feeds
  for select using (active = true);

-- aitea_knowledge_blocks holds editorial prompts + controller config (prompt
-- IP). No anon read policy: RLS stays enabled with zero policies, so only the
-- server's service-role client can read it. The drop below also removes the
-- old public-read policy when re-applying this schema to an existing DB.
drop policy if exists "Public read knowledge blocks" on public.aitea_knowledge_blocks;

drop policy if exists "Public read active people" on public.aitea_people;
create policy "Public read active people" on public.aitea_people
  for select using (active = true);

-- Service-role-only management policies.
drop policy if exists "Service role can manage ingest events" on public.aitea_ingest_events;
create policy "Service role can manage ingest events" on public.aitea_ingest_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage people stats" on public.aitea_people_stats;
create policy "Service role can manage people stats" on public.aitea_people_stats
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage activity log" on public.aitea_activity_log;
create policy "Service role can manage activity log" on public.aitea_activity_log
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage daily metrics" on public.aitea_daily_metrics;
create policy "Service role can manage daily metrics" on public.aitea_daily_metrics
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "aitea_ai_provider_configs_service_role_all" on public.aitea_ai_provider_configs;
create policy "aitea_ai_provider_configs_service_role_all" on public.aitea_ai_provider_configs
  for all to service_role using (true) with check (true);

drop policy if exists "Service role can manage app config" on public.aitea_app_config;
create policy "Service role can manage app config" on public.aitea_app_config
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- aitea_prompts and aitea_workflow_runs have RLS enabled with NO policies,
-- meaning anon/auth roles get nothing; only the service role (which bypasses
-- RLS) can read or write them. This is intentional.

-- ---------------------------------------------------------------------------
-- AI provider secret helpers (store/read provider API keys in Supabase Vault)
-- ---------------------------------------------------------------------------
create or replace function public.aitea_read_ai_provider_secret(secret_id uuid)
 returns text
 language sql
 set search_path to ''
as $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where id = secret_id;
$function$;

create or replace function public.aitea_save_ai_provider_secret(provider_name text, secret_value text, existing_secret_id uuid default null::uuid)
 returns uuid
 language plpgsql
 set search_path to ''
as $function$
declare
  saved_secret_id uuid;
  secret_name text;
begin
  if provider_name not in ('openai', 'anthropic', 'deepseek') then
    raise exception 'Unsupported AI provider';
  end if;

  if length(trim(secret_value)) < 8 then
    raise exception 'API key is too short';
  end if;

  secret_name := 'aitea_ai_' || provider_name || '_api_key';

  if existing_secret_id is not null then
    perform vault.update_secret(
      existing_secret_id,
      secret_value,
      secret_name,
      'The Tool Printer admin AI provider key for ' || provider_name,
      null
    );
    return existing_secret_id;
  end if;

  saved_secret_id := vault.create_secret(
    secret_value,
    secret_name,
    'The Tool Printer admin AI provider key for ' || provider_name,
    null
  );

  return saved_secret_id;
end;
$function$;

commit;
