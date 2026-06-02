import Link from 'next/link';
import { AlertCircle, History, Sparkles } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { activatePromptVersion, createPromptVersion } from '../actions';
import { DEFAULT_THRESHOLDS } from '@/lib/scoring/threshold';

interface PromptRow {
  id: string;
  type: string;
  version: number;
  content: string;
  active: boolean;
  created_at: string;
}

const TYPE_NOTES: Record<string, { label: string; note: string; controllerLink: boolean }> = {
  front_page_generation: {
    label: 'Editorial Update Agent',
    note: 'Used by the Editorial Update Agent to draft and curate front-page items.',
    controllerLink: true,
  },
  quality_manager: {
    label: 'Quality Manager Agent',
    note: 'Used by the Quality Manager Agent to score every candidate against the weighted scorecard.',
    controllerLink: true,
  },
  scoring: {
    label: 'Scoring Prompt',
    note: 'Used by the scoring pipeline to produce the per-dimension breakdown that the Quality Manager weights.',
    controllerLink: false,
  },
};

export default async function PromptsPage() {
  const supabase = createServiceClient();

  const { data: prompts } = await supabase
    .from('aitea_prompts')
    .select('id, type, version, content, active, created_at')
    .order('type', { ascending: true })
    .order('version', { ascending: false });

  const grouped = groupByType((prompts ?? []) as PromptRow[]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prompts &amp; Thresholds</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Every prompt is versioned. Saving the active version creates v+1; older versions are kept and can be restored.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-blue-500/30 bg-blue-500/5 p-4 text-sm leading-6">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-blue-500" />
        <div className="space-y-1">
          <p className="font-semibold">Editing the Editorial or Quality Manager prompts here is equivalent to the editors on <Link href="/admin/controller" className="underline">/admin/controller</Link>.</p>
          <p className="text-muted-foreground">
            Both paths use the same versioned action. Use the Controller page when you want the prompt next to its associated knobs (publishing gate, schedule, scorecard); use this page when you want to see all prompt types in one place and restore older versions.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Score Thresholds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Trending minimum</span>
            <span className="font-mono font-bold">{DEFAULT_THRESHOLDS.trendingMin}+</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Signals range</span>
            <span className="font-mono font-bold">{DEFAULT_THRESHOLDS.signalsMin}-{DEFAULT_THRESHOLDS.trendingMin - 1}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Auto-reject below</span>
            <span className="font-mono font-bold">&lt;{DEFAULT_THRESHOLDS.signalsMin}</span>
          </div>
          <p className="pt-3 text-xs leading-5 text-muted-foreground">
            These thresholds are defined in <code className="rounded bg-muted px-1 py-0.5 text-[11px]">lib/scoring/threshold.ts</code> and require a code change to modify. The Publishing Gate in <Link href="/admin/controller" className="underline">/admin/controller</Link> uses a separate set of thresholds (auto-approve / auto-reject) that <em>are</em> editable from the UI.
          </p>
        </CardContent>
      </Card>

      {grouped.length === 0 ? (
        <p className="text-muted-foreground">No prompt versions saved yet.</p>
      ) : (
        grouped.map(({ type, active, history }) => {
          const meta = TYPE_NOTES[type];
          return (
            <Card key={type}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="capitalize">{meta?.label ?? type}</CardTitle>
                  <Badge variant="outline" className="font-mono text-[11px]">{type}</Badge>
                  {active && <Badge>v{active.version} active</Badge>}
                </div>
                {meta?.note && <p className="mt-1 text-xs text-muted-foreground">{meta.note}</p>}
              </CardHeader>
              <CardContent className="space-y-4">
                {active ? (
                  <form action={createPromptVersion} className="space-y-3">
                    <input type="hidden" name="type" value={type} />
                    <Textarea
                      name="content"
                      defaultValue={active.content}
                      rows={14}
                      className="font-mono text-xs"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        Saving creates v{active.version + 1} and keeps v{active.version} in history.
                      </p>
                      <Button type="submit" size="sm">
                        <Sparkles className="mr-2 size-3.5" />
                        Save new version
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No active version. Restore one below to make it active.
                  </p>
                )}

                {history.length > 0 && (
                  <details className="rounded-md border">
                    <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium">
                      <History className="size-4 text-muted-foreground" />
                      Version history ({history.length})
                    </summary>
                    <div className="space-y-2 border-t p-3">
                      {history.map((prompt) => (
                        <div key={prompt.id} className="space-y-2 rounded-md border bg-muted/30 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">v{prompt.version}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(prompt.created_at).toLocaleString()}
                              </span>
                            </div>
                            <form action={activatePromptVersion.bind(null, prompt.id, prompt.type)}>
                              <Button size="sm" variant="outline" type="submit">Restore</Button>
                            </form>
                          </div>
                          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-background p-2 font-mono text-[11px] leading-5 text-muted-foreground">
                            {prompt.content}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function groupByType(prompts: PromptRow[]) {
  const byType = new Map<string, { active: PromptRow | null; history: PromptRow[] }>();
  for (const prompt of prompts) {
    const entry = byType.get(prompt.type) ?? { active: null, history: [] };
    if (prompt.active && !entry.active) {
      entry.active = prompt;
    } else {
      entry.history.push(prompt);
    }
    byType.set(prompt.type, entry);
  }
  return Array.from(byType.entries()).map(([type, value]) => ({
    type,
    active: value.active,
    history: value.history.sort((a, b) => b.version - a.version),
  }));
}
