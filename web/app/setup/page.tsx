import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { hasAdminPassword } from '@/lib/auth/admin';
import { isSetupComplete } from '@/lib/setup/state';
import { checkEnvironment, checkDatabase, checkContentSeed } from '@/lib/setup/checks';
import { SetupWizard } from './_components/setup-wizard';

export const metadata = {
  title: 'First-run setup · The Tool Printer',
  robots: { index: false, follow: false },
};

export default async function SetupPage() {
  await connection();

  // Dead route once setup has been completed.
  if (await isSetupComplete()) {
    notFound();
  }

  const [env, db, seed] = await Promise.all([
    checkEnvironment(),
    checkDatabase(),
    checkContentSeed(),
  ]);

  const dbReady = db.connected && !db.results.some((r) => r.status === 'fail');

  return (
    <SetupWizard
      env={env}
      database={db.results}
      seed={seed}
      dbReady={dbReady}
      requiresBootstrap={hasAdminPassword()}
    />
  );
}
