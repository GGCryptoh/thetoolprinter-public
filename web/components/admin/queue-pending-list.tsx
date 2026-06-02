'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { discardSelected } from '@/app/admin/actions';

export type QueuePendingItem = {
  id: string;
  title: string;
  source_type: string;
  source_name: string | null;
  score: number | null;
  section: string | null;
  created_at: string;
};

export function QueuePendingList({ items }: { items: QueuePendingItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending items are currently in the pipeline.</p>;
  }

  // Intersect with the current items so ids removed by a delete (after the page
  // revalidates) drop out of the selection without needing an effect.
  const selectedIds = items.map((item) => item.id).filter((id) => selected.has(id));
  const selectedCount = selectedIds.length;
  const allSelected = items.every((item) => selected.has(item.id));

  function toggle(id: string) {
    setConfirming(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setConfirming(false);
    setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)));
  }

  return (
    <form action={discardSelected}>
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="itemIds" value={id} />
      ))}

      <div className="flex items-center justify-between gap-3 pb-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="size-4 rounded border-input"
          />
          {selectedCount > 0 ? `${selectedCount} selected` : 'Select all'}
        </label>

        {selectedCount > 0 &&
          (confirming ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Remove {selectedCount} from queue?</span>
              <ConfirmTrashButton />
              <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)}>
                No
              </Button>
            </div>
          ) : (
            <Button type="button" size="sm" variant="destructive" onClick={() => setConfirming(true)}>
              <Trash2 className="mr-1.5 size-3.5" />
              Trash ({selectedCount})
            </Button>
          ))}
      </div>

      <div className="divide-y">
        {items.map((item) => {
          const isSelected = selected.has(item.id);
          return (
            <label
              key={item.id}
              className={`grid cursor-pointer gap-3 py-3 transition-colors md:grid-cols-[24px_64px_minmax(0,1fr)_120px] md:items-center ${
                isSelected ? 'bg-muted/40' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(item.id)}
                className="size-4 self-center rounded border-input"
              />
              <div className="font-mono text-2xl font-bold">{formatScore(item.score)}</div>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.source_type}</Badge>
                  {item.source_name && <span className="text-xs text-muted-foreground">{item.source_name}</span>}
                </div>
                <p className="truncate text-sm font-medium">{item.title}</p>
              </div>
              <div className="text-left md:text-right">
                <Badge variant={item.score === null ? 'outline' : item.section ? 'default' : 'secondary'}>
                  {item.score === null ? 'awaiting score' : item.section ? item.section : 'awaiting route'}
                </Badge>
                <p className="mt-1 text-xs text-muted-foreground">{formatWhen(item.created_at)}</p>
              </div>
            </label>
          );
        })}
      </div>
    </form>
  );
}

function ConfirmTrashButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="destructive" disabled={pending}>
      {pending ? <Loader2 className="mr-1.5 size-3.5 motion-safe:animate-spin" /> : null}
      Yes, remove
    </Button>
  );
}

function formatScore(score: number | null) {
  return typeof score === 'number' ? score.toFixed(1) : '...';
}

function formatWhen(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
}
