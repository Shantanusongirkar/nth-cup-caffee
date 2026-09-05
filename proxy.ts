import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function proxy() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        // Customer ordering: POST /api/orders is public
        if (req.nextUrl.pathname === '/api/orders' && req.method === 'POST') {
          return true;
        }
        return !!token;
      },
    },
    pages: {
      signIn: '/staff/login',
    },
  }
);

export const config = {
  // Only protect admin pages — customer ordering (/api/orders) is public
  matcher: ['/admin/:path*'],
};