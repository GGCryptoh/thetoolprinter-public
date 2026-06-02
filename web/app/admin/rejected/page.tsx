import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { PaginationControls, parsePage } from '@/components/admin/pagination-controls';
import { approveItem, promoteItem } from '../actions';

const PAGE_SIZE = 30;

export default async function RejectedPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string | string[]; view?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawView = Array.isArray(params?.view) ? params?.view[0] : params?.view;
  const showArchived = rawView === 'archived';
  const page = parsePage(params?.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const supabase = createServiceClient();

  let query = supabase
    .from('aitea_news_items')
    .select('id, title, url, source_type, source_name, score, created_at, archived_at', { count: 'exact' })
    .eq('status', 'rejected');
  query = showArchived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);

  const [{ data: items, count }, activeCountRes, archivedCountRes] = await Promise.all([
    query.order('created_at', { ascending: false }).range(from, to),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'rejected').is('archived_at', null),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'rejected').not('archived_at', 'is', null),
  ]);

  const activeCount = activeCountRes.count ?? 0;
  const archivedCount = archivedCountRes.count ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rejected Items</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {showArchived
              ? 'Archived rejects, kept for analytics. Promote to send one back to the queue.'
              : 'Active rejected candidates. Older ones are auto-archived per the controller retention setting.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/rejected"
            className={buttonVariants({ size: 'sm', variant: showArchived ? 'outline' : 'default' })}
          >
            Active ({activeCount})
          </Link>
          <Link
            href="/admin/rejected?view=archived"
            className={buttonVariants({ size: 'sm', variant: showArchived ? 'default' : 'outline' })}
          >
            Archived ({archivedCount})
          </Link>
        </div>
      </div>

      <PaginationControls basePath={showArchived ? '/admin/rejected?view=archived' : '/admin/rejected'} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />

      {!items || items.length === 0 ? (
        <p className="text-muted-foreground">No rejected items.</p>
      ) : (
        <div className="grid gap-2">
          {items.map((item) => (
            <Card key={item.id} className="opacity-70 hover:opacity-100 transition-opacity py-2">
              <CardContent className="flex items-center gap-4">
                <span className="text-lg font-bold font-mono text-muted-foreground shrink-0 w-10 text-center">{item.score ?? '?'}</span>
                <div className="flex-1 min-w-0">
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline truncate block">
                    {item.title}
                  </a>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.source_type}</Badge>
                    {item.source_name && (
                      <span className="text-[11px] text-muted-foreground">{item.source_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <form action={approveItem.bind(null, item.id)}>
                    <Button size="sm" type="submit" className="h-7 px-3 text-xs">Publish</Button>
                  </form>
                  <form action={promoteItem.bind(null, item.id)}>
                    <Button size="sm" variant="outline" type="submit" className="h-7 px-3 text-xs">Promote</Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PaginationControls basePath={showArchived ? '/admin/rejected?view=archived' : '/admin/rejected'} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </div>
  );
}
