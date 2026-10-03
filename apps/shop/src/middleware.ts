import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

// Gate account pages at the edge: no auth cookie -> go to login and come back after.
// (The API still authorises every request; this is purely UX.)
export function middleware(req: NextRequest) {
  if (!req.cookies.get(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/checkout/:path*', '/orders/:path*', '/account/:path*', '/notifications/:path*', '/wishlist/:path*'] };
