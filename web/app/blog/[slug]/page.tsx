import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getAllPosts, getPostBySlug } from '@/lib/blog/posts';

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: `${post.title} — The Tool Printer`,
    description: post.subtitle,
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <div className={`relative bg-gradient-to-br ${post.gradient}`}>
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        {/* Logo watermark */}
        <div className="absolute top-8 right-8 opacity-[0.06]">
          <img src="/ai_tea_logo.png" alt="" className="w-28 h-28" />
        </div>

        <div className="relative max-w-3xl mx-auto px-6 pt-8 pb-12">
          <Link
            href="/blog"
            className="text-[11px] text-neutral-400 hover:text-neutral-200 uppercase tracking-widest transition-colors"
          >
            &larr; All posts
          </Link>

          <div className="mt-10">
            <div className="flex items-center gap-2 text-[11px] text-neutral-300/70">
              <time>{formatDate(post.date)}</time>
              <span className="w-1 h-1 rounded-full bg-neutral-500" />
              <span>{post.readingTime} read</span>
              <span className="w-1 h-1 rounded-full bg-neutral-500" />
              <span>{post.author}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-light text-white tracking-tight mt-3 leading-tight">
              {post.title}
            </h1>
            <p className="text-base text-neutral-300/70 mt-2 max-w-xl">
              {post.subtitle}
            </p>
            <div className="flex gap-2 mt-5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-0.5 text-[10px] font-mono rounded-full bg-neutral-800/50 text-neutral-400 border border-neutral-700/50"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-5 text-[11px] text-neutral-400">
              By {post.author} · Originally published on{' '}
              <a
                href={`https://thetoolprinter.com/blog/${post.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-400 underline underline-offset-2 hover:text-yellow-300"
              >
                thetoolprinter.com
              </a>
            </p>
          </div>
        </div>
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Article body */}
      <article className="mx-auto max-w-3xl px-6 pb-16 pt-6">
        <div className="max-w-none
          [&_a]:text-amber-400/90 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-amber-300
          [&_strong]:font-semibold [&_strong]:text-neutral-100
        ">
          <MarkdownContent content={post.content} />
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-neutral-800/60 py-8 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/blog"
            className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            &larr; All posts
          </Link>
          <Link
            href="/"
            className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            The Tool Printer &rarr;
          </Link>
        </div>
      </footer>
    </main>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const blocks = content.split('\n\n');
  let paragraphIndex = 0;

  return (
    <>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (trimmed === '---') {
          return <hr key={i} />;
        }

        if (trimmed.startsWith('## ')) {
          return (
            <h2
              key={i}
              className="mb-5 mt-14 border-t border-neutral-800 pt-8 text-2xl font-semibold tracking-tight text-neutral-100 sm:text-3xl"
            >
              {trimmed.slice(3)}
            </h2>
          );
        }

        if (trimmed.startsWith('![')) {
          const match = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
          if (match) {
            const { flags, caption } = parseImageFlags(match[1]);
            const small = flags.has('small');
            const light = flags.has('light');
            const bg = light
              ? 'bg-neutral-50 border-neutral-300'
              : 'bg-neutral-950 border-neutral-800';
            const sizing = small
              ? 'max-h-[520px]'
              : 'max-h-[760px]';
            return (
              <figure key={i} className={small ? 'my-12' : 'my-12 lg:-mx-10'}>
                <img
                  src={match[2]}
                  alt={caption}
                  className={`mx-auto ${sizing} w-auto max-w-full rounded-2xl border ${bg} object-contain shadow-2xl shadow-black/30`}
                />
                {caption && (
                  <figcaption className="mt-3 text-center text-xs leading-5 text-neutral-500">
                    {caption}
                  </figcaption>
                )}
              </figure>
            );
          }
        }

        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={i}
              className="my-10 border-l-2 border-amber-400 pl-5 text-2xl font-medium leading-snug tracking-tight text-neutral-100 sm:text-3xl"
            >
              <span dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed.replace(/^> /, '')) }} />
            </blockquote>
          );
        }

        if (trimmed.startsWith('- **')) {
          const items = trimmed.split('\n').map((line) => line.replace(/^- /, ''));
          return (
            <ul key={i} className="my-7 space-y-3 rounded-xl border border-neutral-800/80 bg-neutral-950/40 p-5">
              {items.map((item, j) => (
                <li
                  key={j}
                  className="relative pl-5 text-base leading-7 text-neutral-300 before:absolute before:left-0 before:top-3 before:size-1.5 before:rounded-full before:bg-amber-400"
                  dangerouslySetInnerHTML={{ __html: inlineFormat(item) }}
                />
              ))}
            </ul>
          );
        }

        if (trimmed.startsWith('* ')) {
          const items = trimmed.split('\n').map((line) => line.replace(/^\* /, ''));
          return (
            <ul key={i} className="my-7 max-w-3xl space-y-3 rounded-xl border border-neutral-800/80 bg-neutral-950/40 p-5">
              {items.map((item, j) => (
                <li
                  key={j}
                  className="relative pl-5 text-base leading-7 text-neutral-300 before:absolute before:left-0 before:top-3 before:size-1.5 before:rounded-full before:bg-amber-400"
                  dangerouslySetInnerHTML={{ __html: inlineFormat(item) }}
                />
              ))}
            </ul>
          );
        }

        if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**')) {
          return (
            <p key={i} className="!text-neutral-500 !text-sm mt-10 italic">
              <span dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed.slice(1, -1)) }} />
            </p>
          );
        }

        paragraphIndex++;
        const isLead = paragraphIndex === 1;

        return (
          <p
            key={i}
            className={
              isLead
                ? 'mb-8 max-w-3xl text-xl leading-9 text-neutral-200 sm:text-2xl sm:leading-10'
                : 'my-5 max-w-3xl text-base leading-8 text-neutral-300 sm:text-[17px] sm:leading-9'
            }
            dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed) }}
          />
        );
      })}
    </>
  );
}

function parseImageFlags(alt: string): { flags: Set<string>; caption: string } {
  const match = alt.match(/^([a-z, ]+):\s*(.*)$/);
  if (!match) return { flags: new Set(), caption: alt };
  const flags = new Set(match[1].split(/[,\s]+/).filter(Boolean));
  return { flags, caption: match[2] };
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/ — /g, ' &mdash; ');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
