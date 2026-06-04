import { Suspense } from 'react';
import { connection } from 'next/server';
import Link from 'next/link';
import { checkAuth } from '@/lib/auth/admin';
import { Separator } from '@/components/ui/separator';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/guide', label: 'First-time Guide' },
  { href: '/admin/health', label: 'System Health' },
  { href: '/admin/queue', label: 'Pipeline Queue' },
  { href: '/admin/operations', label: 'Operations' },
  { href: '/admin/approvals', label: 'Human Review Desk' },
  { href: '/admin/rejected', label: 'Rejected' },
  { href: '/admin/ai-providers', label: 'AI Providers' },
  { href: '/admin/controller', label: 'Controller' },
  { href: '/admin/ingestion', label: 'Ingestion' },
  { href: '/admin/feeds', label: 'Feeds' },
  { href: '/admin/people', label: 'People' },
  { href: '/admin/prompts', label: 'Prompts' },
  { href: '/admin/financials', label: 'Financials' },
  { href: '/admin/security', label: 'Security' },
  { href: '/admin/knowledge', label: 'Knowledge' },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  await connection();
  // Verify the JWT here, not just cookie presence — the middleware is the
  // primary gate, but the layout renders service-role data and shouldn't
  // depend on a single check (middleware bypass is a known Next.js CVE class).
  const authed = await checkAuth();

  // If not authenticated, render children directly (login page)
  if (!authed) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border bg-card p-4 flex flex-col gap-2">
        <Link href="/admin/dashboard" className="text-lg font-bold tracking-tight mb-2">
          The Tool Printer Admin
        </Link>
        <Separator />
        <nav className="flex flex-col gap-1 mt-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <Separator className="mb-2" />
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors block"
          >
            Back to site
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Suspense fallback={<div className="text-neutral-400 text-sm">Loading...</div>}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}

function AdminFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-sm text-muted-foreground">Loading admin...</div>
    </div>
  );
}
