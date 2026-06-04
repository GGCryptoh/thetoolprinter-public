/**
 * Fail-closed auth for cron/workflow endpoints.
 *
 * A missing CRON_SECRET must break the cron (503), never unlock it — these
 * endpoints kick off paid LLM/Apify runs and data pruning. Vercel cron sends
 * `Authorization: Bearer <CRON_SECRET>` automatically when the env var is
 * set; manual triggers may also pass `?token=<CRON_SECRET>`.
 *
 * Returns null when authorized, otherwise the error Response to return.
 */
export function requireCronAuth(req: Request): Response | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json(
      { error: 'CRON_SECRET is not configured. Refusing to run unauthenticated.' },
      { status: 503 },
    );
  }

  const authHeader = req.headers.get('authorization');
  const token = new URL(req.url).searchParams.get('token');
  if (authHeader === `Bearer ${cronSecret}` || token === cronSecret) {
    return null;
  }

  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
