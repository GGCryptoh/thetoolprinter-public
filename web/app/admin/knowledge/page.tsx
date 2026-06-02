import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { updateKnowledgeBlock } from '../actions';

const MANAGED_CATEGORIES: Record<string, { managedBy: string; href: string }> = {
  front_page_controller: { managedBy: 'Front Page Controller', href: '/admin/controller' },
  front_page_sections: { managedBy: 'Front Page Controller (sections)', href: '/admin/controller' },
  quality_manager_scorecard: { managedBy: 'Front Page Controller (quality scorecard)', href: '/admin/controller' },
  ingest_control: { managedBy: 'Operations (Run/Stop ingest)', href: '/admin/operations' },
};

export default async function KnowledgePage() {
  const supabase = createServiceClient();

  const { data: blocks } = await supabase
    .from('aitea_knowledge_blocks')
    .select('id, category, title, content_json, sort_order')
    .order('sort_order', { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Knowledge Blocks</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Raw JSON for every config row in <code className="rounded bg-muted px-1 py-0.5 text-[11px]">aitea_knowledge_blocks</code>. Use this only when you need to inspect or repair something the regular admin pages can&apos;t reach.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm leading-6">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-yellow-500" />
        <div className="space-y-1">
          <p className="font-semibold">Danger zone — these blocks have safer editors elsewhere.</p>
          <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
            <li><code className="rounded bg-muted px-1 py-0.5 text-[11px]">front_page_controller</code>, <code className="rounded bg-muted px-1 py-0.5 text-[11px]">front_page_sections</code>, <code className="rounded bg-muted px-1 py-0.5 text-[11px]">quality_manager_scorecard</code> — edit in <Link href="/admin/controller" className="font-semibold underline">/admin/controller</Link> instead. Direct JSON edits here will surface on the front page but bypass validation.</li>
            <li><code className="rounded bg-muted px-1 py-0.5 text-[11px]">ingest_control</code> — managed by <Link href="/admin/operations" className="font-semibold underline">/admin/operations</Link>. If <code className="rounded bg-muted px-1 py-0.5 text-[11px]">stopRequested: true</code> is left in here, all future ingest runs will stop themselves. Clearing this row is the recovery path for a wedged stop flag.</li>
            <li>Malformed JSON saved here will fail silently and leave the row unchanged until it parses.</li>
          </ul>
        </div>
      </div>

      {!blocks || blocks.length === 0 ? (
        <p className="text-muted-foreground">
          No knowledge blocks yet. Seed them in Supabase (categories: models, context, memory, skills).
        </p>
      ) : (
        blocks.map((block) => {
          const managed = MANAGED_CATEGORIES[block.category];
          return (
            <Card key={block.id} className={managed ? 'border-yellow-500/30' : undefined}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 capitalize">
                  <span>{block.category}: {block.title}</span>
                  {managed && <Badge variant="outline" className="border-yellow-500/50 text-yellow-600 dark:text-yellow-400">Managed</Badge>}
                </CardTitle>
                {managed && (
                  <p className="text-xs text-muted-foreground">
                    Prefer editing via{' '}
                    <Link href={managed.href} className="font-medium underline">
                      {managed.managedBy}
                    </Link>
                    .
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <form
                  action={async (formData: FormData) => {
                    'use server';
                    const content = formData.get('content') as string;
                    await updateKnowledgeBlock(block.id, content);
                  }}
                  className="space-y-4"
                >
                  <Textarea
                    name="content"
                    defaultValue={JSON.stringify(block.content_json, null, 2)}
                    rows={10}
                    className="font-mono text-xs"
                  />
                  <Button type="submit" size="sm">Save</Button>
                </form>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
