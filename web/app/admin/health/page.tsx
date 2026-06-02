import { connection } from 'next/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckList } from '@/components/admin/check-list';
import { runAllChecks } from '@/lib/setup/checks';

export default async function HealthPage() {
  await connection();
  const groups = await runAllChecks();

  const all = groups.flatMap((g) => g.results);
  const fails = all.filter((r) => r.status === 'fail').length;
  const warns = all.filter((r) => r.status === 'warn').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Health</h1>
          <p className="text-sm text-muted-foreground">
            Live verification of environment, database, content, automation, and AI scoring.
          </p>
        </div>
        <div className="flex gap-2">
          {fails === 0 && warns === 0 ? (
            <Badge className="bg-emerald-500/15 text-emerald-600">All systems go</Badge>
          ) : (
            <>
              {fails > 0 && <Badge variant="destructive">{fails} failing</Badge>}
              {warns > 0 && (
                <Badge className="bg-amber-500/15 text-amber-600">{warns} warning</Badge>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle className="text-base">{group.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CheckList results={group.results} />
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Re-run by reloading this page. Failing checks block a clean launch; warnings are usually
        optional (Apify, cron secret, empty pipeline before first run).
      </p>
    </div>
  );
}
