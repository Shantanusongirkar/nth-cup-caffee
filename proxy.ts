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
        // Public order tracking
        if (req.nextUrl.pathname === '/api/orders/track') {
          return true;
        }
        // Public menu endpoint
        if (req.nextUrl.pathname === '/api/menu') {
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
  // Protect admin pages and admin API routes — customer-facing endpoints are public
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};