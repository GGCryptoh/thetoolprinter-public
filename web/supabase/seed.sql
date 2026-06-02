-- The Tool Printer — starter seed data
-- Run AFTER schema.sql. Idempotent: safe to re-run (existing rows are left alone).
-- Seeds configuration/content tables only. Runtime tables (news_items,
-- ingest_events, workflow_runs, daily_metrics, people_stats) start empty and
-- fill once the ingest pipeline runs.

begin;

-- ---------------------------------------------------------------------------
-- Feeds (data sources). No natural unique key, so guard by url.
-- ---------------------------------------------------------------------------
insert into public.aitea_feeds (type, name, url, config, active)
select v.type, v.name, v.url, v.config::jsonb, v.active
from (values
  ('github',   'GitHub Trending',     'https://github.com/trending',                                  '{}',                                          true),
  ('rss',      'TechCrunch AI',       'https://techcrunch.com/category/artificial-intelligence/feed/','{}',                                          true),
  ('rss',      'The Verge AI',        'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml','{}',                                      true),
  ('rss',      'MIT Tech Review AI',  'https://www.technologyreview.com/feed/',                       '{}',                                          true),
  ('youtube',  'AI Explained',        'https://www.youtube.com/@aiexplained-official',               '{"channelId":"UCMnFZMjzUWAfGRzpOL0wGjA","cadenceHours":24}', true),
  ('youtube',  'Matt Wolfe',          'https://www.youtube.com/@maboroshi',                          '{"channelId":"UCR13l93VgaSITBXMNH-GP1Q","cadenceHours":24}', true),
  ('youtube',  'Greg Isenberg',       'https://www.youtube.com/@GregIsenberg',                       '{"channelId":"UCwbQ9iMRf5oMFQc3vmIzifQ","cadenceHours":24}', true),
  ('youtube',  'Nick Saraev',         'https://www.youtube.com/@nicksaraev',                         '{"maxResults":10,"scrapeIdeas":true,"cadenceHours":24}',     true),
  ('twitter',  'Andrej Karpathy',     'https://x.com/karpathy',                                       '{"handle":"karpathy","cadenceHours":24}',     true),
  ('twitter',  'Jim Fan',             'https://x.com/DrJimFan',                                       '{"handle":"DrJimFan","cadenceHours":24}',     true),
  ('linkedin', 'Geoff Hopkins',       'https://www.linkedin.com/in/geoffhopkins/',                    '{"maxPosts":2,"cadenceHours":24,"actor":"supreme_coder~linkedin-post"}', true)
) as v(type, name, url, config, active)
where not exists (select 1 from public.aitea_feeds f where f.url = v.url);

-- ---------------------------------------------------------------------------
-- People to follow. Guard by handle.
-- ---------------------------------------------------------------------------
insert into public.aitea_people (name, handle, avatar_url, description, tags, sort_order, active, url, sources)
select v.name, v.handle, v.avatar_url, v.description, v.tags::text[], v.sort_order, v.active, v.url, v.sources::text[]
from (values
  ('Nick Saraev',     'nicksaraev', 'https://unavatar.io/x/nicksaraev', 'Great content, extremely relevant for this space',                                            '{}',                                  0, true, '@nicksaraev',               '{youtube}'),
  ('Andrej Karpathy', 'karpathy',   'https://unavatar.io/x/karpathy',   'Former Tesla AI Director, OpenAI founding member. Deep learning, neural nets, practical AI.',  '{models,research,education}',         1, true, 'https://x.com/karpathy',     '{twitter}'),
  ('Jim Fan',         'DrJimFan',   'https://unavatar.io/x/DrJimFan',   'NVIDIA Senior Research Scientist. Embodied AI, foundation agents, robotics.',                  '{research,agents,robotics}',          2, true, 'https://x.com/DrJimFan',     '{twitter}'),
  ('Simon Willison',  'simonw',     'https://unavatar.io/x/simonw',     'Creator of Datasette, Django co-creator. LLM tools, prompt engineering, open source.',        '{tools,prompts,open-source}',         3, true, 'https://simonwillison.net',  '{twitter}'),
  ('Swyx',            'swyx',       'https://unavatar.io/x/swyx',       'Latent Space podcast, AI Engineer community founder. AI engineering patterns and industry analysis.', '{community,patterns,agents}',  4, true, 'https://x.com/swyx',         '{twitter}'),
  ('Harrison Chase',  'hwchase17',  'https://unavatar.io/x/hwchase17',  'LangChain CEO. Agent frameworks, RAG patterns, AI infrastructure.',                           '{agents,tools,infra}',                5, true, 'https://x.com/hwchase17',    '{twitter}'),
  ('Greg Isenberg',   'gregisenberg','https://unavatar.io/x/gregisenberg','Startup builder, Late Checkout CEO. AI for business, community-driven products, no-code AI.', '{business,automation,startups}',     6, true, 'https://x.com/gregisenberg', '{twitter,youtube}')
) as v(name, handle, avatar_url, description, tags, sort_order, active, url, sources)
where not exists (select 1 from public.aitea_people p where p.handle = v.handle);

-- ---------------------------------------------------------------------------
-- Knowledge blocks + operational control rows (unique by category).
-- front_page_controller and ingest_control are config, not reader content.
-- ---------------------------------------------------------------------------
insert into public.aitea_knowledge_blocks (category, title, content_json, sort_order) values
  ('front_page_controller', 'Front Page Controller',
   $$ {"visible":true,"promptType":"front_page_generation","articleCount":6,"scoreLimitPerRun":50,"scheduleUnit":"hours","scheduleEvery":24,"scheduleMode":"business","scheduleTimezone":"America/New_York","businessStartHour":8,"businessEndHour":20,"weekdayEveryHours":4,"weekendEveryHours":24,"previewEnabled":true,"aiUpdatesEnabled":true,"qualityPromptType":"quality_manager","publishingGateMode":"hybrid","autoRejectThreshold":6.1,"autoApproveThreshold":6.5,"maxAutoApprovedPerRun":3,"rejectedRetentionDays":0} $$::jsonb,
   0),
  ('models', 'Models',
   $$ [{"url":"https://docs.anthropic.com/en/docs/about-claude/models","name":"Claude Opus 4.6","description":"Most capable. 1M context, agent SDK, deep reasoning."},{"url":"https://docs.anthropic.com/en/docs/about-claude/models","name":"Claude Sonnet 4.6","description":"Best balance of speed and capability. Production workhorse."},{"url":"https://platform.openai.com/docs/models","name":"GPT-5.4","description":"OpenAI latest. Strong agentic reasoning and code generation."},{"url":"https://ai.google.dev/gemini-api/docs","name":"Gemini 3.1 Flash","description":"Fast multimodal with native image generation."},{"url":"https://llama.meta.com","name":"Llama 4 Scout","description":"Best open-weight model. 10M context with MoE."}] $$::jsonb,
   1),
  ('context', 'Context Engineering',
   $$ [{"url":"https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering","name":"Structured Prompts","description":"XML tags, markdown sections, and role definitions."},{"url":"https://docs.anthropic.com/en/docs/build-with-claude/retrieval-augmented-generation","name":"RAG Patterns","description":"Retrieval-augmented generation with reranking."},{"url":"https://www.anthropic.com/research/building-effective-agents","name":"Memory Injection","description":"Episodic and semantic memory for long conversations."},{"url":"https://modelcontextprotocol.io","name":"Tool Orchestration","description":"MCP servers and function calling patterns."}] $$::jsonb,
   2),
  ('memory', 'Memory Patterns',
   $$ [{"url":"https://python.langchain.com/docs/concepts/memory/","name":"Conversation Buffer","description":"Simple sliding window of recent messages."},{"url":"https://docs.mem0.ai","name":"Episodic Memory","description":"Store and retrieve notable past interactions."},{"url":"https://supabase.com/docs/guides/ai/vector-columns","name":"Semantic Memory","description":"Vector-indexed knowledge base from past context."},{"url":"https://www.anthropic.com/research/building-effective-agents","name":"Procedural Memory","description":"Learned patterns and preferences over time."}] $$::jsonb,
   3),
  ('ingest_control', 'Ingest Control',
   $$ {"stopRequested":false} $$::jsonb,
   3),
  ('skills', 'Agent Skills',
   $$ [{"url":"https://www.anthropic.com/products/claude-code","name":"Code Generation","description":"Write, test, and debug code autonomously."},{"url":"https://docs.tavily.com","name":"Web Research","description":"Search, scrape, and synthesize information."},{"url":"https://sdk.vercel.ai","name":"Data Analysis","description":"Query databases, generate charts, find patterns."},{"url":"https://vercel.com/docs/workflow","name":"Workflow Automation","description":"Chain tools and APIs for complex multi-step tasks."}] $$::jsonb,
   4)
on conflict (category) do nothing;

-- ---------------------------------------------------------------------------
-- Scoring prompts (versioned; only v3 active — the Quality Manager prompt).
-- ---------------------------------------------------------------------------
insert into public.aitea_prompts (type, version, content, active) values
('scoring', 1, $prompt$You are the Quality Manager Agent for The Tool Printer, an AI intelligence brief for executives, advisors, and operators. Today is {{date}}.

Score each candidate item as an editorial asset for a governance-literate, anti-hype audience. Rate each dimension from 0 to 10 and use the full range:

- relevance: Fit to AI agency, governance, trust, identity, and enterprise operator concerns.
- novelty: How new or distinct is this versus the normal AI news cycle?
- impact: Significance for the AI field or enterprise adoption.
- evidence: Concrete facts, primary sources, dates, named entities, demos, numbers, or technical detail.
- governanceFit: Connection to authority, auditability, liability, provenance, identity, controls, or trust.
- operatorUsefulness: Would this help a builder, consultant, or leader make a better decision?
- sourceQuality: Credibility and specificity of the source relative to the claim.
- clarity: Can it be explained without fake certainty or buzzword fog?
- distinctiveness: Does it avoid sounding like the same generic AI post everyone else publishes?
- riskAwareness: Does it surface constraints, failure modes, regulation, or implementation risk?

Recency is computed automatically from each item publish date, so do not score it.

Then provide:
- overall: a 0 to 10 holistic editorial score. Reward decision-useful, governance-relevant, well-evidenced items. Penalize thin summaries, repeated stories, unverified claims, shallow vendor announcements, and content that sounds plausible but has no operational consequence.
- qualityReason: one short sentence justifying the score.
- tags: an array of short topic tags.
- summary: a one-line summary.

For EACH item return a JSON object with relevance, novelty, impact, evidence, governanceFit, operatorUsefulness, sourceQuality, clarity, distinctiveness, riskAwareness, overall, qualityReason, tags, and summary.

Return a JSON object with a "results" array, one entry per item, in the same order as the input. Return only valid JSON with no Markdown.

Items:
{{items}}$prompt$, true)
on conflict (type, version) do nothing;

commit;
