import {
  checkPassword,
  hasAdminPassword,
  setAdminPassword,
  signToken,
  setAuthCookie,
} from '@/lib/auth/admin';
import { isSetupComplete, markSetupComplete } from '@/lib/setup/state';
import { checkDatabase } from '@/lib/setup/checks';

export async function POST(req: Request) {
  // Once setup is done this endpoint is closed.
  if (await isSetupComplete()) {
    return Response.json({ error: 'Setup is already complete.' }, { status: 410 });
  }

  let body: { password?: string; confirm?: string; bootstrap?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  // The database must be reachable with the schema applied before we can store anything.
  const db = await checkDatabase();
  if (!db.connected || db.results.some((r) => r.status === 'fail')) {
    return Response.json(
      { error: 'Database is not ready. Apply schema.sql first.', checks: db.results },
      { status: 400 }
    );
  }

  // The bootstrap password is REQUIRED to complete setup. Without this, a
  // deploy that's publicly reachable before setup finishes lets any anonymous
  // visitor set the admin password and take over (first-run takeover).
  if (!hasAdminPassword()) {
    return Response.json(
      { error: 'Set ADMIN_PASS on the server before completing setup. It authorizes this one-time bootstrap.' },
      { status: 403 }
    );
  }
  if (!body.bootstrap || !(await checkPassword(body.bootstrap))) {
    return Response.json(
      { error: 'Current bootstrap password (ADMIN_PASS) is required to complete setup.' },
      { status: 401 }
    );
  }

  const password = (body.password ?? '').trim();
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  if (password !== (body.confirm ?? '').trim()) {
    return Response.json({ error: 'Passwords do not match.' }, { status: 400 });
  }

  try {
    await setAdminPassword(password);
    await markSetupComplete();
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }

  // Log the operator straight in.
  try {
    const token = await signToken();
    await setAuthCookie(token);
  } catch {
    // Non-fatal: they can still log in at /admin.
    return Response.json({ ok: true, loggedIn: false });
  }

  return Response.json({ ok: true, loggedIn: true });
}
