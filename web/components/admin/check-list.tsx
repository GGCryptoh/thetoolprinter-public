import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { CheckResult, CheckStatus } from '@/lib/setup/checks';

const ICONS: Record<CheckStatus, typeof CheckCircle2> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
};

const COLORS: Record<CheckStatus, string> = {
  ok: 'text-emerald-500',
  warn: 'text-amber-500',
  fail: 'text-destructive',
};

export function CheckRow({ result }: { result: CheckResult }) {
  const Icon = ICONS[result.status];
  return (
    <li className="flex items-start gap-3 py-2">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${COLORS[result.status]}`} />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{result.label}</p>
        <p className="text-xs text-muted-foreground">{result.detail}</p>
      </div>
    </li>
  );
}

export function CheckList({ results }: { results: CheckResult[] }) {
  return (
    <ul className="divide-y divide-border">
      {results.map((r) => (
        <CheckRow key={r.id} result={r} />
      ))}
    </ul>
  );
}
