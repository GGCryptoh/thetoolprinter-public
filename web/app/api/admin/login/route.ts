import { checkPassword, hasAnyAdminPassword, signToken, setAuthCookie } from '@/lib/auth/admin';

// Simple in-memory rate limiter (resets on cold start — fine for MVP)
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  if (isRateLimited(ip)) {
    return Response.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429 }
    );
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!(await hasAnyAdminPassword())) {
    return Response.json(
      { error: 'Admin password is not configured. Set ADMIN_PASS or complete /setup.' },
      { status: 500 }
    );
  }

  if (!body.password || !(await checkPassword(body.password))) {
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }

  try {
    const token = await signToken();
    await setAuthCookie(token);
  } catch {
    return Response.json(
      { error: 'Admin session secret is not configured in Vercel.' },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
