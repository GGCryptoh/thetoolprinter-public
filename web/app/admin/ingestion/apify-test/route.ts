import { checkAuth } from '@/lib/auth/admin';

export async function GET() {
  const authed = await checkAuth();
  if (!authed) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    return Response.json({
      ok: false,
      message: 'APIFY_API_TOKEN is not visible to this runtime.',
    });
  }

  try {
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${token}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return Response.json({
        ok: false,
        message: `Apify returned HTTP ${res.status}. Rotate or re-check the Vercel env var.`,
      });
    }

    const data = await res.json();
    return Response.json({
      ok: true,
      message: `Connected to Apify as ${data?.data?.username ?? data?.data?.email ?? 'configured user'}.`,
    });
  } catch (err) {
    return Response.json({
      ok: false,
      message: err instanceof Error ? err.message : 'Apify connection failed.',
    });
  }
}
