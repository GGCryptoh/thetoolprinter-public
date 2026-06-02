import Link from 'next/link';
import { connection } from 'next/server';
import { Activity, Eye, EyeOff, Gauge, History, RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createServiceClient } from '@/lib/supabase/server';
import {
  DEFAULT_FRONT_PAGE_PROMPT,
  DEFAULT_QUALITY_MANAGER_PROMPT,
  getActivePrompt,
  getFrontPageController,
  getFrontPageItems,
  getFrontPageSections,
  getQualityDimensions,
} from '@/lib/front-page/controller';
import { ResetButton } from '@/components/admin/reset-button';
import { PublishingGateControls } from '@/components/admin/publishing-gate-controls';
import {
  activatePromptVersion,
  createPromptVersion,
  resetEditorialPrompt,
  resetFrontPageController,
  resetFrontPageSections,
  resetQualityDimensions,
  resetQualityManagerPrompt,
  saveFrontPageController,
  saveFrontPageSections,
  saveQualityDimensions,
} from '../actions';

const GATE_PREVIEW_WINDOW_DAYS = 7;

export default async function ControllerPage() {
  await connection();
  const supabase = createServiceClient();
  const gatePreviewSince = new Date();
  gatePreviewSince.setDate(gatePreviewSince.getDate() - GATE_PREVIEW_WINDOW_DAYS);
  const gatePreviewCutoff = gatePreviewSince.toISOString();

  const [settings, sections, dimensions, editorialPrompt, qualityPrompt, liveItems, counts, prompts, recentScored] =
    await Promise.all([
      getFrontPageController(),
      getFrontPageSections(),
      getQualityDimensions(),
      getActivePrompt('front_page_generation', DEFAULT_FRONT_PAGE_PROMPT),
      getActivePrompt('quality_manager', DEFAULT_QUALITY_MANAGER_PROMPT),
      getFrontPageItems(8),
      Promise.all([
        supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      ]),
      supabase
        .from('aitea_prompts')
        .select('id, type, version, content, active, created_at')
        .in('type', ['front_page_generation', 'quality_manager', 'scoring'])
        .order('type', { ascending: true })
        .order('version', { ascending: false }),
      supabase
        .from('aitea_news_items')
        .select('score')
        .not('score', 'is', null)
        .gte('scored_at', gatePreviewCutoff),
    ]);

  const [approved, pending, rejected] = counts;
  const promptRows = prompts.data ?? [];
  const recentScores = (recentScored.data ?? [])
    .map((row) => row.score)
    .filter((score): score is number => typeof score === 'number');
  const totalWeight = dimensions.reduce((sum, item) => sum + item.weight, 0);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Front Page Controller</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Control what appears on the public page, how often the AI loop should refresh,
              which prompt version is active, and how the Quality Manager Agent scores candidates.
            </p>
          </div>
          <Badge variant={settings.visible ? 'default' : 'secondary'} className="gap-1.5">
            {settings.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
            {settings.visible ? 'Front page visible' : 'Front page hidden'}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Approved" value={approved.count ?? 0} />
          <MetricCard label="Pending" value={pending.count ?? 0} />
          <MetricCard label="Rejected" value={rejected.count ?? 0} />
          <MetricCard label="Quality Weight" value={`${totalWeight}`} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="size-5" />
              Visibility and AI update loop
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveFrontPageController} className="space-y-5">
              <div className="grid gap-3 lg:grid-cols-3">
                <ToggleField
                  name="visible"
                  label="Visible"
                  defaultChecked={settings.visible}
                  description="If off, the public page uses editorial fallback and suppresses live feed modules."
                />
                <ToggleField
                  name="aiUpdatesEnabled"
                  label="AI Updates"
                  defaultChecked={settings.aiUpdatesEnabled}
                  description="If off, scheduled AI-driven refreshes should skip front-page generation."
                />
                <ToggleField
                  name="previewEnabled"
                  label="Preview Pane"
                  defaultChecked={settings.previewEnabled}
                  description="Show the right-side preview and live metrics in this controller."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduleEvery">Every</Label>
                  <Input
                    id="scheduleEvery"
                    name="scheduleEvery"
                    type="number"
                    min={1}
                    max={52}
                    defaultValue={settings.scheduleEvery}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduleUnit">Unit</Label>
                  <select
                    id="scheduleUnit"
                    name="scheduleUnit"
                    defaultValue={settings.scheduleUnit}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="articleCount">Articles to show</Label>
                  <Input
                    id="articleCount"
                    name="articleCount"
                    type="number"
                    min={1}
                    max={50}
                    defaultValue={settings.articleCount}
                  />
                  <p className="text-xs text-muted-foreground">Home-page article count.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scoreLimitPerRun">Items to score / run</Label>
                  <Input
                    id="scoreLimitPerRun"
                    name="scoreLimitPerRun"
                    type="number"
                    min={1}
                    max={500}
                    defaultValue={settings.scoreLimitPerRun}
                  />
                  <p className="text-xs text-muted-foreground">
                    How many queued items the Quality Manager scores each run. Publishing is capped
                    separately below.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promptType">Prompt type</Label>
                  <Input id="promptType" name="promptType" defaultValue={settings.promptType} />
                  <input type="hidden" name="qualityPromptType" value={settings.qualityPromptType} />
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
                Vercel Cron is the build-time clock and now wakes this endpoint hourly. The saved
                controller cadence is the runtime policy: scheduled ticks skip themselves until this
                interval is due. Manual admin runs bypass the schedule.
                <br />
                <strong>Interval</strong> uses “Every / Unit” above. <strong>Business hours</strong>
                {' '}runs every “Weekday every (h)” inside the daytime window on Mon–Fri, and every
                {' '}“Weekend every (h)” on Sat/Sun (set 0 to skip weekends). Per-source cadence
                {' '}(e.g. Apify feeds) is still controlled by each feed’s <code>cadenceHours</code>.
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="scheduleMode">Schedule mode</Label>
                  <select
                    id="scheduleMode"
                    name="scheduleMode"
                    defaultValue={settings.scheduleMode}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="interval">Interval (Every / Unit)</option>
                    <option value="business">Business hours (weekday window + weekend)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduleTimezone">Timezone (IANA)</Label>
                  <Input
                    id="scheduleTimezone"
                    name="scheduleTimezone"
                    defaultValue={settings.scheduleTimezone}
                    placeholder="America/New_York"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weekdayEveryHours">Weekday every (h)</Label>
                  <Input
                    id="weekdayEveryHours"
                    name="weekdayEveryHours"
                    type="number"
                    min={1}
                    max={24}
                    defaultValue={settings.weekdayEveryHours}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessStartHour">Window start (0–23)</Label>
                  <Input
                    id="businessStartHour"
                    name="businessStartHour"
                    type="number"
                    min={0}
                    max={23}
                    defaultValue={settings.businessStartHour}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessEndHour">Window end (1–24)</Label>
                  <Input
                    id="businessEndHour"
                    name="businessEndHour"
                    type="number"
                    min={1}
                    max={24}
                    defaultValue={settings.businessEndHour}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weekendEveryHours">Weekend every (h, 0=off)</Label>
                  <Input
                    id="weekendEveryHours"
                    name="weekendEveryHours"
                    type="number"
                    min={0}
                    max={168}
                    defaultValue={settings.weekendEveryHours}
                  />
                </div>
              </div>

              <PublishingGateControls
                defaults={{
                  publishingGateMode: settings.publishingGateMode,
                  autoApproveThreshold: settings.autoApproveThreshold,
                  autoRejectThreshold: settings.autoRejectThreshold,
                  maxAutoApprovedPerRun: settings.maxAutoApprovedPerRun,
                }}
                recentScores={recentScores}
                windowDays={GATE_PREVIEW_WINDOW_DAYS}
              />

              <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-[minmax(0,1fr)_140px] sm:items-center">
                <div>
                  <Label htmlFor="rejectedRetentionDays" className="text-sm font-medium">
                    Auto-archive rejected after (days)
                  </Label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    A daily job hides rejected items older than this from /admin/rejected. They stay in the
                    database for analytics — they are not deleted. Set to <strong>0</strong> to never archive.
                  </p>
                </div>
                <Input
                  id="rejectedRetentionDays"
                  name="rejectedRetentionDays"
                  type="number"
                  min={0}
                  max={3650}
                  step={1}
                  defaultValue={settings.rejectedRetentionDays}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit">Save controller settings</Button>
              </div>
            </form>
            <form action={resetFrontPageController} className="mt-2">
              <ResetButton confirmMessage="Reset controller settings (visibility, schedule, publishing gate) to the built-in defaults? This does not touch news items or prompts." />
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="size-5" />
              Front-page section controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveFrontPageSections} className="space-y-3">
              {sections.map((section) => (
                <details key={section.key} className="group rounded-md border" open={section.key === 'main_thesis'}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{section.label}</p>
                        <Badge variant={section.visible ? 'default' : 'secondary'}>
                          {section.visible ? 'Visible' : 'Hidden'}
                        </Badge>
                        {section.aiUpdatesEnabled && <Badge variant="outline">AI updates</Badge>}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{section.currentSurface}</p>
                    </div>
                    <span className="text-xs text-muted-foreground group-open:hidden">Edit</span>
                    <span className="hidden text-xs text-muted-foreground group-open:inline">Close</span>
                  </summary>
                  <div className="space-y-4 border-t p-3">
                    <div className="grid gap-3 lg:grid-cols-2">
                      <ToggleField
                        name={`${section.key}-visible`}
                        label="Visible"
                        defaultChecked={section.visible}
                        description="Controls whether this surface appears on the public front page."
                      />
                      <ToggleField
                        name={`${section.key}-aiUpdatesEnabled`}
                        label="AI Updates"
                        defaultChecked={section.aiUpdatesEnabled}
                        description="Lets the scheduled agent update or select content for this surface."
                      />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`${section.key}-currentSurface`}>Current surface</Label>
                        <Input
                          id={`${section.key}-currentSurface`}
                          name={`${section.key}-currentSurface`}
                          defaultValue={section.currentSurface}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${section.key}-liveSource`}>Live source</Label>
                        <Input
                          id={`${section.key}-liveSource`}
                          name={`${section.key}-liveSource`}
                          defaultValue={section.liveSource}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor={`${section.key}-articleCount`}>Count</Label>
                        <Input
                          id={`${section.key}-articleCount`}
                          name={`${section.key}-articleCount`}
                          type="number"
                          min={1}
                          max={50}
                          defaultValue={section.articleCount}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${section.key}-scheduleEvery`}>Every</Label>
                        <Input
                          id={`${section.key}-scheduleEvery`}
                          name={`${section.key}-scheduleEvery`}
                          type="number"
                          min={1}
                          max={52}
                          defaultValue={section.scheduleEvery}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${section.key}-scheduleUnit`}>Unit</Label>
                        <select
                          id={`${section.key}-scheduleUnit`}
                          name={`${section.key}-scheduleUnit`}
                          defaultValue={section.scheduleUnit}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        >
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${section.key}-prompt`}>Prompt override</Label>
                      <Textarea
                        id={`${section.key}-prompt`}
                        name={`${section.key}-prompt`}
                        defaultValue={section.prompt}
                        rows={3}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                </details>
              ))}
              <Button type="submit">Save section controls</Button>
            </form>
            <form action={resetFrontPageSections} className="mt-2">
              <ResetButton confirmMessage="Reset all front-page section visibility, schedules, and prompts to defaults? Any per-section overrides you saved will be lost." />
            </form>
          </CardContent>
        </Card>

        <PromptEditor
          title="Editorial Update Agent Prompt"
          type="front_page_generation"
          prompt={editorialPrompt}
          fallback={DEFAULT_FRONT_PAGE_PROMPT}
          rows={14}
          resetAction={resetEditorialPrompt}
          resetConfirm="Reset the editorial agent prompt? This creates a new version (vN+1) with the built-in default content. The previous version stays in history."
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-5" />
              Quality Manager Agent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <PromptEditor
              title="Quality Manager Prompt"
              type="quality_manager"
              prompt={qualityPrompt}
              fallback={DEFAULT_QUALITY_MANAGER_PROMPT}
              rows={8}
              embedded
              resetAction={resetQualityManagerPrompt}
              resetConfirm="Reset the Quality Manager prompt? This creates a new version (vN+1) with the built-in default content. The previous version stays in history."
            />

            <div className="rounded-md border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
              Each dimension contributes to the 0–10 weighted score on every candidate. Weights should sum to <strong>100</strong>{totalWeight === 100 ? '.' : ` — current total is ${totalWeight}.`}
              {totalWeight !== 100 && (
                <span className="ml-1 font-semibold text-yellow-500">Adjust the weights so they total 100, or scores will be skewed.</span>
              )}
            </div>

            <form action={saveQualityDimensions} className="space-y-3">
              <div className="grid gap-3">
                {dimensions.map((dimension) => (
                  <div key={dimension.key} className="grid gap-3 rounded-md border p-3 lg:grid-cols-[140px_80px_minmax(0,1fr)]">
                    <div>
                      <p className="text-sm font-medium">{dimension.label}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {dimension.key}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${dimension.key}-weight`}>Weight</Label>
                      <Input
                        id={`${dimension.key}-weight`}
                        name={`${dimension.key}-weight`}
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={dimension.weight}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${dimension.key}-description`}>Definition</Label>
                      <Input
                        id={`${dimension.key}-description`}
                        name={`${dimension.key}-description`}
                        defaultValue={dimension.description}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <Button type="submit" variant="outline">Save quality scorecard</Button>
            </form>
            <form action={resetQualityDimensions} className="mt-2">
              <ResetButton confirmMessage="Reset the quality scorecard weights and dimension descriptions to defaults? Future scoring runs will use the rebalanced weights." />
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-5" />
              Prompt Versions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {promptRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved prompt versions yet. Saving a prompt creates v1.</p>
            ) : (
              promptRows.map((prompt) => (
                <div key={prompt.id} className="flex items-center justify-between gap-4 rounded-md border px-3 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{prompt.type}</span>
                      <Badge variant="outline">v{prompt.version}</Badge>
                      {prompt.active && <Badge>Active</Badge>}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{prompt.content}</p>
                  </div>
                  {!prompt.active && (
                    <form action={activatePromptVersion.bind(null, prompt.id, prompt.type)}>
                      <Button size="sm" variant="outline" type="submit">Restore</Button>
                    </form>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
        <details open={settings.previewEnabled} className="group rounded-xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Activity className="size-4 text-yellow-500 motion-safe:animate-pulse" />
              Preview pane
            </span>
            <span className="text-xs text-muted-foreground group-open:hidden">Open</span>
            <span className="text-xs text-muted-foreground hidden group-open:inline">Collapse</span>
          </summary>
          <div className="space-y-4 p-4">
            <div className="rounded-md border bg-background p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-yellow-500">
                Public page state
              </p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight">
                {settings.visible ? 'Live feed enabled' : 'Editorial fallback mode'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The homepage will show up to {settings.articleCount} approved items when visible.
                AI updates are {settings.aiUpdatesEnabled ? 'on' : 'off'}.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Top live candidates
              </p>
              {liveItems.length === 0 ? (
                <p className="rounded-md border p-4 text-sm text-muted-foreground">
                  No approved items yet. The public page will keep its fallback editorial examples.
                </p>
              ) : (
                liveItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    className="block rounded-md border p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
                      <span className="font-mono text-xs text-yellow-500">{item.score ?? '?'}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {item.summary ?? item.source_name ?? item.source_type}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </details>
      </aside>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-yellow-500/50" />
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ToggleField({
  name,
  label,
  defaultChecked,
  description,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border p-4">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="mt-1" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function PromptEditor({
  title,
  type,
  prompt,
  fallback,
  rows,
  embedded,
  resetAction,
  resetConfirm,
}: {
  title: string;
  type: string;
  prompt: { version: number; content: string; active: boolean };
  fallback: string;
  rows: number;
  embedded?: boolean;
  resetAction?: () => Promise<void>;
  resetConfirm?: string;
}) {
  const body = (
    <div className="space-y-3">
      <form action={createPromptVersion} className="space-y-4">
        <input type="hidden" name="type" value={type} />
        <Textarea
          name="content"
          defaultValue={prompt.content || fallback}
          rows={rows}
          className="font-mono text-xs"
        />
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Active version: v{prompt.version}. Saving creates a new active version and keeps history.
          </p>
          <Button type="submit" size="sm">
            <Sparkles className="mr-2 size-3.5" />
            Save new version
          </Button>
        </div>
      </form>
      {resetAction && resetConfirm && (
        <form action={resetAction}>
          <ResetButton label="Reset prompt to default" confirmMessage={resetConfirm} />
        </form>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
