import { cookies } from 'next/headers';

const API = () => process.env.API_URL ?? 'http://localhost:4000';

/**
 * Server-side fetch to the Nest API (server components).
 * Public catalogue calls use ISR (`revalidate`); pass `auth` with the app's cookie name to forward the session.
 */
export async function serverApi<T>(path: string, opts: { revalidate?: number | false; auth?: string } = {}): Promise<T | null> {
  const headers: Record<string, string> = {};
  if (opts.auth) {
    const token = (await cookies()).get(opts.auth)?.value;
    if (token) headers.authorization = `Bearer ${token}`;
  }
  try {
    const res = await fetch(`${API()}/api/v1${path}`, {
      headers,
      ...(opts.auth ? { cache: 'no-store' as const } : { next: { revalidate: opts.revalidate ?? 60 } }),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API ${res.status} ${path}`);
    return (await res.json()) as T;
  } catch (e) {
    console.error('[serverApi]', path, (e as Error).message);
    return null;
  }
}
