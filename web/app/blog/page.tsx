import Link from 'next/link';
import { getAllPosts } from '@/lib/blog/posts';

export const metadata = {
  title: 'Blog — The Tool Printer',
  description: 'Building the first autonomous hobby business, in public.',
};

export default function BlogIndex() {
  const posts = getAllPosts();
  const [featured, ...rest] = posts;

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-[11px] text-neutral-400 hover:text-neutral-200 uppercase tracking-widest transition-colors"
            >
              &larr; The Tool Printer
            </Link>
            <div className="flex items-center gap-3">
              <img src="/ai_tea_logo.png" alt="" className="w-6 h-6 rounded-md opacity-60" />
              <span className="text-[11px] text-neutral-500 uppercase tracking-widest">Blog</span>
            </div>
          </div>
          <h1 className="text-4xl font-light text-white tracking-tight mt-8">
            Building in Public
          </h1>
          <p className="text-base text-neutral-400 mt-2 max-w-lg">
            The unfiltered story of building the first autonomous hobby business — every decision, every failure, every breakthrough.
          </p>
          <div className="mt-6 h-px bg-gradient-to-r from-amber-800/50 via-neutral-800 to-transparent" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 pb-16">
        {/* Featured post — hero card */}
        {featured && (
          <Link href={`/blog/${featured.slug}`} className="block group mb-10">
            <article className={`relative rounded-2xl overflow-hidden border border-neutral-800/60 bg-gradient-to-br ${featured.gradient}`}>
              <div className="relative z-10 p-8 sm:p-10 min-h-[280px] flex flex-col justify-end">
                {/* Decorative grid */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }} />
                {/* Logo watermark */}
                <div className="absolute top-6 right-6 opacity-10">
                  <img src="/ai_tea_logo.png" alt="" className="w-20 h-20" />
                </div>
                <div className="relative">
                  <div className="flex items-center gap-2 text-[11px] text-neutral-300/80 mb-3">
                    <span className="px-2 py-0.5 rounded-full bg-amber-800/30 border border-amber-700/30 text-amber-300 text-[10px] font-medium uppercase tracking-wider">
                      Latest
                    </span>
                    <time>{formatDate(featured.date)}</time>
                    <span className="w-1 h-1 rounded-full bg-neutral-500" />
                    <span>{featured.readingTime} read</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-light text-white leading-snug group-hover:text-neutral-100 transition-colors">
                    {featured.title}
                  </h2>
                  <p className="text-sm text-neutral-300/80 mt-2 max-w-xl leading-relaxed">
                    {featured.subtitle}
                  </p>
                  <div className="flex items-center gap-3 mt-4">
                    <div className="flex gap-2">
                      {featured.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-neutral-800/60 text-neutral-400 border border-neutral-700/50"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="text-[11px] text-neutral-400 group-hover:text-amber-400 transition-colors ml-auto">
                      Read &rarr;
                    </span>
                  </div>
                </div>
              </div>
            </article>
          </Link>
        )}

        {/* Older posts */}
        {rest.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-[11px] text-neutral-500 uppercase tracking-widest mb-4">Previous posts</h3>
            {rest.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block group"
              >
                <article className="flex gap-5 rounded-xl border border-neutral-800/60 bg-neutral-900/30 p-5 transition-colors hover:border-neutral-700 hover:bg-neutral-900/50">
                  {/* Color accent bar */}
                  <div className={`w-1 shrink-0 rounded-full bg-gradient-to-b ${post.gradient}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-neutral-400 mb-1.5">
                      <time>{formatDate(post.date)}</time>
                      <span className="w-1 h-1 rounded-full bg-neutral-600" />
                      <span>{post.readingTime} read</span>
                    </div>
                    <h2 className="text-base font-medium text-neutral-100 group-hover:text-white transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-sm text-neutral-400 mt-0.5 line-clamp-1">
                      {post.subtitle}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-800/60 py-6 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/ai_tea_logo.png" alt="" className="w-5 h-5 rounded-md opacity-50" />
            <span className="text-[11px] text-neutral-500">The Tool Printer</span>
          </div>
          <Link href="/" className="text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors">
            thetoolprinter.com
          </Link>
        </div>
      </footer>
    </main>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
