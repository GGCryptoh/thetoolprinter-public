'use client';

export function DateStamp() {
  return (
    <time className="text-[11px] font-mono text-neutral-400">
      {new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}
    </time>
  );
}
