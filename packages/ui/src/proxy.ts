/**
 * Same-origin API proxy for each web app: mount it at app/api/v1/[...path]/route.ts.
 *
 * The browser only ever talks to its own app (shop, sell, deliver, admin). This handler forwards
 * /api/v1/* to the Nest API, turning the app's own session cookie into a Bearer token, and stores
 * tokens the API returns (login / register) in that cookie. Each app therefore keeps a separate
 * first-party session - logging into Admin never logs you into the Shop - even on localhost,
 * where all four apps share one host on different ports.
 */
import { cookies } from 'next/headers';

const API = () => process.env.API_URL ?? 'http://localhost:4000';
const HOP = ['host', 'connection', 'content-length', 'accept-encoding', 'cookie', 'authorization'];

export function createApiProxy(cookieName: string) {
  async function handler(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
    const { path } = await ctx.params;
    const url = new URL(req.url);
    const target = `${API()}/api/v1/${path.map(encodeURIComponent).join('/')}${url.search}`;
    const jar = await cookies();
    const token = jar.get(cookieName)?.value;

    const headers = new Headers();
    req.headers.forEach((v, k) => !HOP.includes(k.toLowerCase()) && headers.set(k, v));
    if (token) headers.set('authorization', `Bearer ${token}`);
    const fwd = req.headers.get('x-forwarded-for');
    if (fwd) headers.set('x-forwarded-for', fwd);

    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer();
    let res: Response;
    try {
      res = await fetch(target, { method: req.method, headers, body, redirect: 'manual', cache: 'no-store' });
    } catch {
      return Response.json({ message: 'The service is unavailable. Please try again in a moment.' }, { status: 503 });
    }

    const out = new Headers();
    res.headers.forEach((v, k) => !['set-cookie', 'content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k) && out.set(k, v));
    const buf = await res.arrayBuffer();
    const secure = url.protocol === 'https:';
    const cookie = (value: string, maxAge: number) =>
      `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;

    const p = path.join('/');
    if (res.ok && /(^auth\/(login|register)$)|(^(seller|rider)\/register$)/.test(p)) {
      try {
        const data = JSON.parse(new TextDecoder().decode(buf));
        if (data?.token) out.append('set-cookie', cookie(data.token, 7 * 24 * 3600));
      } catch {
        /* not JSON */
      }
    }
    if (p === 'auth/logout' || res.status === 401) {
      if (token) out.append('set-cookie', cookie('', 0));
    }
    return new Response(req.method === 'HEAD' ? null : buf, { status: res.status, headers: out });
  }
  return { GET: handler, POST: handler, PUT: handler, PATCH: handler, DELETE: handler, HEAD: handler };
}
