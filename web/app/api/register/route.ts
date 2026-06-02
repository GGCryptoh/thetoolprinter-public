import { NextResponse } from 'next/server';

interface RegisterRequest {
  email?: unknown;
  intent?: unknown;
  source?: unknown;
}

// Process-local rate limit. Registration is a once-per-person action; cap at
// 3 attempts/hour/IP to absorb honest typo retries while killing anything
// past that. Resets per cold start, which is fine alongside Vercel's edge
// DDoS protection. Swap for Upstash / Vercel KV if you want a distributed,
// cold-start-resistant limit.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
const buckets = new Map<string, number[]>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recent = (buckets.get(key) ?? []).filter((stamp) => stamp > cutoff);
  if (recent.length >= RATE_LIMIT_MAX) {
    buckets.set(key, recent);
    return true;
  }
  recent.push(now);
  buckets.set(key, recent);
  return false;
}

export async function POST(request: Request) {
  const key = clientKey(request);
  if (rateLimited(key)) {
    return NextResponse.json(
      { error: 'You\'ve already registered. Try again in an hour if this looks wrong.' },
      { status: 429, headers: { 'Retry-After': '3600' } },
    );
  }

  let payload: RegisterRequest;
  try {
    payload = (await request.json()) as RegisterRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const intent = typeof payload.intent === 'string' ? payload.intent : 'tool-printer-api';
  const source = typeof payload.source === 'string' ? payload.source : 'what-is-this';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const authToken = process.env.N8N_AUTH;

  if (!webhookUrl || !authToken) {
    return NextResponse.json(
      { error: 'Registration is offline. Set N8N_WEBHOOK_URL and N8N_AUTH on the server.' },
      { status: 503 },
    );
  }

  try {
    const upstream = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authToken,
      },
      body: JSON.stringify({ email, intent, source, product: 'the-tool-printer' }),
    });

    const text = await upstream.text();
    const data = text
      ? (() => {
          try {
            return JSON.parse(text);
          } catch {
            return { raw: text };
          }
        })()
      : { success: upstream.ok };

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Upstream registration failed', detail: data },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Could not reach registration service', detail: message }, { status: 502 });
  }
}
