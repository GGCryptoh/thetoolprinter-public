import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'aitea-admin';

function getSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), browsing-topics=()'
  );
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-admin routes entirely — just add security headers
  if (!pathname.startsWith('/admin/') && pathname !== '/admin') {
    return addSecurityHeaders(NextResponse.next());
  }

  // Allow the login page and login API without auth
  if (pathname === '/admin' || pathname.startsWith('/api/')) {
    return addSecurityHeaders(NextResponse.next());
  }

  // All other /admin/* pages require auth
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  const secret = getSecret();
  if (!secret) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  try {
    await jwtVerify(token, secret);
  } catch {
    const response = NextResponse.redirect(new URL('/admin', request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
