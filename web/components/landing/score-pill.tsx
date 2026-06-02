export function ScorePill({ score }: { score: number | null }) {
  if (score === null) return null;

  const bg =
    score >= 9
      ? 'bg-neutral-100 text-neutral-900'
      : score >= 7
        ? 'bg-neutral-700 text-neutral-100'
        : 'bg-neutral-800 text-neutral-400';

  return (
    <span
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-mono font-medium ${bg}`}
    >
      {score}
    </span>
  );
}
