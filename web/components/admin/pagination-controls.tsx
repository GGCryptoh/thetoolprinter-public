import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PaginationControls({
  basePath,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const sep = basePath.includes('?') ? '&' : '?';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-mono text-foreground">{from}</span>-<span className="font-mono text-foreground">{to}</span> of{' '}
        <span className="font-mono text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={`${basePath}${sep}page=${Math.max(1, page - 1)}`}
          aria-disabled={page <= 1}
          className={cn(
            buttonVariants({ size: 'sm', variant: 'outline' }),
            page <= 1 && 'pointer-events-none opacity-50',
          )}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Link>
        <span className="min-w-16 text-center font-mono text-xs text-muted-foreground">
          {page}/{pageCount}
        </span>
        <Link
          href={`${basePath}${sep}page=${Math.min(pageCount, page + 1)}`}
          aria-disabled={page >= pageCount}
          className={cn(
            buttonVariants({ size: 'sm', variant: 'outline' }),
            page >= pageCount && 'pointer-events-none opacity-50',
          )}
        >
          Next
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

export function parsePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw ?? 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}
