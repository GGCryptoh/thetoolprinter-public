export function SectionHeader({
  label,
  subtitle,
  count,
}: {
  label: string;
  subtitle?: string;
  count?: number;
}) {
  return (
    <div className="flex items-end justify-between mb-5 border-b border-neutral-800 pb-3">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-200">
          {label}
        </h2>
        {subtitle && (
          <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {count !== undefined && count > 0 && (
        <span className="px-2.5 py-0.5 text-[10px] font-mono rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
          {count}
        </span>
      )}
    </div>
  );
}
