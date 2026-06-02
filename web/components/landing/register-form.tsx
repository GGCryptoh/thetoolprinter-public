'use client';

import { useEffect, useState } from 'react';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const STORAGE_KEY = 'the-tool-printer-api-interest';

interface StoredInterest {
  email: string;
  registeredAt: string;
}

function readStored(): StoredInterest | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.email === 'string' && typeof parsed.registeredAt === 'string') {
      return parsed as StoredInterest;
    }
    return null;
  } catch {
    return null;
  }
}

export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [stored, setStored] = useState<StoredInterest | null>(null);

  useEffect(() => {
    const storedInterest = readStored();
    queueMicrotask(() => {
      setStored(storedInterest);
      setHydrated(true);
    });
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('submitting');
    setMessage(null);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, intent: 'tool-printer-api-interest', source: 'what-is-this' }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setStatus('error');
        setMessage(data.error ?? 'Could not register that email.');
        return;
      }
      const entry: StoredInterest = { email, registeredAt: new Date().toISOString() };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
      } catch {
        // ignore storage errors
      }
      setStored(entry);
      setStatus('success');
      setMessage('You’re on the list. We’ll email you when v0.2 ships.');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Network error.');
    }
  };

  if (hydrated && stored) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-300">Interest registered</p>
        <h3 className="mt-2 text-lg font-semibold leading-snug text-white">
          You&rsquo;re on the v0.2 list.
        </h3>
        <p className="mt-2 text-sm leading-6 text-neutral-300">
          We&rsquo;ll email <span className="font-mono text-emerald-200">{stored.email}</span> as soon
          as the API ships and your token is ready.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-neutral-800 bg-neutral-950/60 p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-yellow-400">API · v0.2</p>
      <h3 className="mt-2 text-lg font-semibold leading-snug text-white">
        Register interest in the harness API.
      </h3>
      <p className="mt-2 text-sm leading-6 text-neutral-400">
        Drop your email and we&rsquo;ll let you know when the read API lands so you can pipe the
        governed feed straight into Claude Code, Codex, or any harness — without burning your own
        scoring tokens on slop.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="register-email">Email address</label>
        <input
          id="register-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-black/40 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-yellow-400/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === 'submitting' || !hydrated}
          className="inline-flex items-center gap-2 rounded-md border border-yellow-300/40 bg-yellow-400 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-950 transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'submitting' ? 'Sending…' : 'Register interest'}
        </button>
      </div>
      {message && (
        <p
          className={`mt-3 text-xs leading-5 ${
            status === 'success' ? 'text-emerald-300' : status === 'error' ? 'text-rose-300' : 'text-neutral-400'
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
