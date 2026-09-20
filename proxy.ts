import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes — skip auth check entirely
  if (pathname === '/api/orders' && req.method === 'POST') return NextResponse.next();
  if (pathname === '/api/orders/track') return NextResponse.next();
  if (pathname === '/api/menu') return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const signInUrl = new URL('/staff/login', req.url);
    signInUrl.searchParams.set('callbackUrl', req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Protect admin pages and admin API routes — customer-facing endpoints are public
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};