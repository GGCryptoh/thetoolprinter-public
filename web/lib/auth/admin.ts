import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { timingSafeEqual, randomBytes, scryptSync } from 'crypto';
import { getStoredAdminAuth, storeAdminAuth } from '@/lib/setup/state';

const COOKIE_NAME = 'aitea-admin';
const EXPIRATION = '7d';
const SCRYPT_KEYLEN = 64;

function getSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error('ADMIN_JWT_SECRET not set');
  return new TextEncoder().encode(secret);
}

function getAdminPassword() {
  return (
    process.env.ADMIN_PASS ??
    process.env.ADMIN_PASSWORD ??
    process.env.AITEA_ADMIN_PASS ??
    process.env.AITEA_ADMIN_PASSWORD ??
    ''
  );
}

export function hasAdminPassword(): boolean {
  return Boolean(getAdminPassword().trim());
}

// ── DB-stored password (set via /setup), with scrypt hashing ───────────────

/** Hash a plaintext password for storage. */
export function hashPassword(plain: string): { hash: string; salt: string; algo: string } {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, SCRYPT_KEYLEN).toString('hex');
  return { hash, salt, algo: 'scrypt' };
}

function verifyAgainstHash(plain: string, hash: string, salt: string): boolean {
  const derived = scryptSync(plain, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** Persist a new admin password (hashed) to the database. */
export async function setAdminPassword(plain: string): Promise<void> {
  await storeAdminAuth(hashPassword(plain));
}

/** True if a password is configured anywhere — DB or env. */
export async function hasAnyAdminPassword(): Promise<boolean> {
  if (hasAdminPassword()) return true;
  const stored = await getStoredAdminAuth();
  return Boolean(stored?.hash && stored?.salt);
}

export async function signToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export async function checkPassword(password: string): Promise<boolean> {
  const candidate = password.trim();
  if (!candidate) return false;

  // Prefer the DB-stored password (set via /setup) when present.
  const stored = await getStoredAdminAuth();
  if (stored?.hash && stored?.salt) {
    return verifyAgainstHash(candidate, stored.hash, stored.salt);
  }

  // Fall back to the env bootstrap password.
  const adminPass = getAdminPassword();
  if (!adminPass) return false;

  // Timing-safe comparison to prevent timing attacks
  const a = Buffer.from(candidate);
  const b = Buffer.from(adminPass.trim());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token);
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
