import { ManualApprovals } from '@/components/admin/manual-approvals';
import { Card, CardContent } from '@/components/ui/card';
import { PaginationControls, parsePage } from '@/components/admin/pagination-controls';
import { createServiceClient } from '@/lib/supabase/server';
import { approveSelected, rejectSelected } from '../actions';

const PAGE_SIZE = 40;

export default async function ManualApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const page = parsePage(params?.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const supabase = createServiceClient();

  const { data: items, count } = await supabase
    .from('aitea_news_items')
    .select('id, title, url, source_type, source_name, summary, score, score_breakdown, tags, created_at', { count: 'exact' })
    .eq('status', 'pending')
    .not('score', 'is', null)
    .order('score', { ascending: false })
    .range(from, to);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Human Review Desk</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          The canonical approval surface. Filter scored candidates, approve the clean ones,
          and use inline confirmation before rejecting. Hover a row to inspect the article
          preview and Quality Manager rationale.
        </p>
      </div>

      <PaginationControls basePath="/admin/approvals" page={page} pageSize={PAGE_SIZE} total={count ?? 0} />

      {!items || items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">
            No scored pending items need manual approval right now.
          </CardContent>
        </Card>
      ) : (
        <ManualApprovals
          items={items}
          approveSelectedAction={approveSelected}
          rejectSelectedAction={rejectSelected}
        />
      )}

      <PaginationControls basePath="/admin/approvals" page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </div>
  );
}
