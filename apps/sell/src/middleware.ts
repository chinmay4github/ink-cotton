import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

// No session cookie -> straight to sign-in (the API still authorises every call; this is UX only).
export function middleware(req: NextRequest) {
  if (!req.cookies.get(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!login|register|api|img|_next|icon.svg|favicon.ico).*)'] };
