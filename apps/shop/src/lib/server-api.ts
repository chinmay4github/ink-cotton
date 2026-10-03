import 'server-only';
import { serverApi as base } from '@ic/ui/server';
import { SESSION_COOKIE } from './session';

/** Server-side API fetch. `auth: true` forwards the shopper's session. */
export const serverApi = <T>(path: string, opts: { revalidate?: number | false; auth?: boolean } = {}) =>
  base<T>(path, { revalidate: opts.revalidate, auth: opts.auth ? SESSION_COOKIE : undefined });
