'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Eye, Filter, Search, ShieldCheck, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type ApprovalItem = {
  id: string;
  title: string;
  url: string;
  source_type: string;
  source_name: string | null;
  summary: string | null;
  score: number | null;
  score_breakdown: Record<string, unknown> | null;
  tags: string[];
  created_at: string;
};

type ManualApprovalsProps = {
  items: ApprovalItem[];
  approveSelectedAction: (formData: FormData) => void | Promise<void>;
  rejectSelectedAction: (formData: FormData) => void | Promise<void>;
};

export function ManualApprovals({
  items,
  approveSelectedAction,
  rejectSelectedAction,
}: ManualApprovalsProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [minScore, setMinScore] = useState('all');
  const sourceOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.source_type))).sort(),
    [items],
  );
  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const threshold = minScore === 'all' ? 0 : Number(minScore);

    return items.filter((item) => {
      const score = item.score ?? 0;
      const sourceMatches = sourceFilter === 'all' || item.source_type === sourceFilter;
      const scoreMatches = score >= threshold;
      const queryMatches =
        needle.length === 0 ||
        item.title.toLowerCase().includes(needle) ||
        (item.summary ?? '').toLowerCase().includes(needle) ||
        (item.source_name ?? '').toLowerCase().includes(needle);

      return sourceMatches && scoreMatches && queryMatches;
    });
  }, [items, minScore, query, sourceFilter]);
  const allVisibleSelected = filteredItems.length > 0 && filteredItems.every((item) => selected.has(item.id));
  const selectedItems = useMemo(() => items.filter((item) => selected.has(item.id)), [items, selected]);

  const toggleAll = (checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const item of filteredItems) {
        if (checked) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
  };

  const toggleItem = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,1fr)_180px_160px_auto] lg:items-end">
          <label className="block text-sm">
            <span className="mb-2 flex items-center gap-2 font-medium">
              <Search className="size-4 text-muted-foreground" />
              Search candidates
            </span>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title, source, or rationale"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-2 flex items-center gap-2 font-medium">
              <Filter className="size-4 text-muted-foreground" />
              Source
            </span>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">All sources</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-2 block font-medium">Minimum score</span>
            <select
              value={minScore}
              onChange={(event) => setMinScore(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">Any score</option>
              <option value="9">9+</option>
              <option value="8">8+</option>
              <option value="7">7+</option>
              <option value="6">6+</option>
            </select>
          </label>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{filteredItems.length}</span> visible /{' '}
            <span className="font-mono text-foreground">{items.length}</span> waiting
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(event) => toggleAll(event.target.checked)}
              className="size-4"
            />
            <span className="font-medium">Select visible items</span>
            <span className="text-muted-foreground">
              {selected.size}/{items.length} selected
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <BulkActionForm action={approveSelectedAction} ids={selectedItems.map((item) => item.id)}>
              <Button type="submit" size="sm" disabled={selected.size === 0}>
                <ShieldCheck className="mr-2 size-3.5" />
                Approve selected
              </Button>
            </BulkActionForm>
            <BulkActionForm action={rejectSelectedAction} ids={selectedItems.map((item) => item.id)}>
              <Button type="submit" size="sm" variant="destructive" disabled={selected.size === 0}>
                <XCircle className="mr-2 size-3.5" />
                Reject selected
              </Button>
            </BulkActionForm>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-2">
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-sm text-muted-foreground">
              No candidates match those filters.
            </CardContent>
          </Card>
        ) : filteredItems.map((item) => {
          const breakdown = item.score_breakdown ?? {};
          const qualityReason = String(breakdown.qualityReason ?? item.summary ?? 'No score reason yet.');
          return (
            <Card key={item.id} className="group relative py-3">
              <CardContent className="grid gap-4 px-4 md:grid-cols-[32px_86px_minmax(0,1fr)_220px] md:items-center">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={(event) => toggleItem(item.id, event.target.checked)}
                  className="size-4"
                  aria-label={`Select ${item.title}`}
                />

                <div className="md:text-center">
                  <p className="font-mono text-3xl font-bold leading-none">{formatScore(item.score)}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">score</p>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.source_type}</Badge>
                    {item.source_name && <span className="text-xs text-muted-foreground">{item.source_name}</span>}
                    <span className="text-xs text-muted-foreground">{formatWhen(item.created_at)}</span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block truncate text-sm font-medium hover:underline"
                  >
                    {item.title}
                  </a>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{qualityReason}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {scoreChips(breakdown).map(([label, value]) => (
                      <span key={label} className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {label}:{String(value)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap justify-start gap-1.5 md:justify-end">
                  <BulkActionForm action={approveSelectedAction} ids={[item.id]}>
                    <Button size="sm" type="submit" className="h-7 px-3 text-xs">Approve</Button>
                  </BulkActionForm>
                  {confirmRejectId === item.id ? (
                    <div className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-1">
                      <span className="px-2 text-xs text-destructive">Reject?</span>
                      <BulkActionForm action={rejectSelectedAction} ids={[item.id]}>
                        <Button size="sm" variant="destructive" type="submit" className="h-7 px-2 text-xs">Yes</Button>
                      </BulkActionForm>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        className="h-7 px-2 text-xs"
                        onClick={() => setConfirmRejectId(null)}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      type="button"
                      className="h-7 px-3 text-xs"
                      onClick={() => setConfirmRejectId(item.id)}
                    >
                      Reject
                    </Button>
                  )}
                </div>
              </CardContent>

              <ArticlePreview item={item} qualityReason={qualityReason} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function BulkActionForm({
  action,
  ids,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  ids: string[];
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      {ids.map((id) => (
        <input key={id} type="hidden" name="itemIds" value={id} />
      ))}
      {children}
    </form>
  );
}

function ArticlePreview({ item, qualityReason }: { item: ApprovalItem; qualityReason: string }) {
  return (
    <div className="pointer-events-none absolute right-4 top-[calc(100%-4px)] z-20 hidden w-[min(520px,calc(100vw-320px))] rounded-md border bg-popover p-4 text-popover-foreground shadow-2xl group-hover:block">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-yellow-500" />
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Article preview</p>
          </div>
          <h3 className="mt-3 text-base font-semibold leading-6">{item.title}</h3>
        </div>
        <span className="font-mono text-2xl font-bold text-yellow-500">{formatScore(item.score)}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{qualityReason}</p>
      <p className="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground">{item.summary}</p>
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <ExternalLink className="size-3.5" />
        <span className="truncate">{item.url}</span>
      </div>
    </div>
  );
}

function scoreChips(breakdown: Record<string, unknown>) {
  return [
    ['rel', breakdown.relevance],
    ['rec', breakdown.recency],
    ['gov', breakdown.governanceFit],
    ['op', breakdown.operatorUsefulness],
    ['nov', breakdown.novelty],
  ].filter(([, value]) => value !== null && value !== undefined) as Array<[string, unknown]>;
}

function formatScore(score: number | null) {
  return typeof score === 'number' ? score.toFixed(1) : '...';
}

function formatWhen(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
  });
}
