import type { Response } from 'express';
import { AUTH_COOKIE } from '../auth/jwt.strategy';

/** httpOnly session cookie. Each web app proxies /api/v1 on its own origin, so this cookie is first-party there. */
export const setSessionCookie = (res: Response, token: string) =>
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 3600 * 1000,
    path: '/',
  });

export const slugify = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
