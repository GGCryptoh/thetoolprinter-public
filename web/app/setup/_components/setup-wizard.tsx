'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckList } from '@/components/admin/check-list';
import type { CheckResult } from '@/lib/setup/checks';

export function SetupWizard({
  env,
  database,
  seed,
  dbReady,
  requiresBootstrap,
}: {
  env: CheckResult[];
  database: CheckResult[];
  seed: CheckResult[];
  dbReady: boolean;
  requiresBootstrap: boolean;
}) {
  const [bootstrap, setBootstrap] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);

    const res = await fetch('/api/setup/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, confirm, bootstrap }),
    });

    if (res.ok) {
      window.location.assign('/admin/health');
      return;
    }

    const data = await res.json().catch(() => null);
    setError(data?.error ?? 'Setup failed.');
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">First-run setup</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">The Tool Printer</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A one-time wizard to verify your install and set the admin password. After it completes,
          this page is closed (404).
        </p>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1 · Environment</CardTitle>
          </CardHeader>
          <CardContent>
            <CheckList results={env} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2 · Database</CardTitle>
          </CardHeader>
          <CardContent>
            <CheckList results={database} />
            {!dbReady && (
              <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                Apply <code>web/supabase/schema.sql</code> (then <code>seed.sql</code>) in the
                Supabase SQL editor, then reload this page.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">3 · Starter content</CardTitle>
          </CardHeader>
          <CardContent>
            <CheckList results={seed} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">4 · Set the admin password</CardTitle>
          </CardHeader>
          <CardContent>
            {dbReady ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {requiresBootstrap && (
                  <div className="space-y-1.5">
                    <Label htmlFor="bootstrap">Current bootstrap password (ADMIN_PASS)</Label>
                    <Input
                      id="bootstrap"
                      type="password"
                      value={bootstrap}
                      onChange={(e) => setBootstrap(e.target.value)}
                      autoComplete="off"
                    />
                    <p className="text-xs text-muted-foreground">
                      Required because an ADMIN_PASS is already set — proves you own this install.
                    </p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="password">New admin password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Finishing setup…' : 'Complete setup'}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Fix the database checks above before setting a password.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
