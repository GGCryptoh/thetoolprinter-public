export default function Loading() {
  return (
    <main className="min-h-screen bg-[#0b0b0d] text-neutral-100">
      <div className="border-b border-neutral-800/90 bg-[#0b0b0d]/95">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-6 px-4 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="size-7 rounded-md border border-yellow-500/35 bg-yellow-500/10" />
            <div className="h-3 w-40 rounded-sm bg-neutral-800/60" />
          </div>
          <div className="hidden gap-2 sm:flex">
            <div className="h-7 w-24 rounded-md bg-neutral-800/40" />
            <div className="h-7 w-28 rounded-md bg-neutral-800/40" />
            <div className="h-7 w-24 rounded-md bg-neutral-800/40" />
          </div>
        </div>
      </div>

      <section className="grid min-h-[calc(100vh-64px)] border-b border-neutral-800/90 lg:grid-cols-[1fr_1.26fr_0.74fr]">
        <SkeletonColumn />
        <SkeletonStories />
        <SkeletonColumn questions />
      </section>
    </main>
  );
}

function SkeletonColumn({ questions = false }: { questions?: boolean }) {
  return (
    <div className="border-r border-neutral-800/90 px-4 py-10 sm:px-8">
      <Bar className="h-2 w-24 bg-yellow-500/30" />
      <Bar className="mt-8 h-12 w-3/4 bg-neutral-800/60" />
      <Bar className="mt-3 h-12 w-2/3 bg-neutral-800/60" />
      <Bar className="mt-8 h-3 w-full bg-neutral-800/40" />
      <Bar className="mt-2 h-3 w-5/6 bg-neutral-800/40" />
      <Bar className="mt-2 h-3 w-4/6 bg-neutral-800/40" />
      {questions && (
        <div className="mt-10 space-y-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Bar className="h-2 w-12 bg-neutral-800/40" />
              <Bar className="h-4 w-full bg-neutral-800/50" />
              <Bar className="h-4 w-5/6 bg-neutral-800/50" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonStories() {
  return (
    <div className="px-4 py-10 sm:px-8">
      <Bar className="h-2 w-32 bg-neutral-800/60" />
      <div className="mt-6 space-y-6">
        {[0, 1, 2].map((i) => (
          <article
            key={i}
            className={`rounded-md border p-6 ${
              i === 0
                ? 'border-emerald-500/20'
                : i === 1
                  ? 'border-red-500/20'
                  : 'border-yellow-500/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <Bar className="h-2 w-24 bg-neutral-800/40" />
              <Bar className="h-5 w-10 bg-neutral-800/60" />
            </div>
            <Bar className="mt-5 h-7 w-3/4 bg-neutral-800/60" />
            <Bar className="mt-2 h-7 w-2/3 bg-neutral-800/60" />
            <Bar className="mt-4 h-3 w-full bg-neutral-800/40" />
            <Bar className="mt-2 h-3 w-5/6 bg-neutral-800/40" />
          </article>
        ))}
      </div>
    </div>
  );
}

function Bar({ className }: { className: string }) {
  return <div className={`rounded-sm motion-safe:animate-pulse ${className}`} />;
}
