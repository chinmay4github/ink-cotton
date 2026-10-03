/**
 * Browser-side API client. Calls go to /api/v1 on the web origin (proxied to the Nest API by
 * next.config rewrites), so the httpOnly auth cookie is sent automatically.
 */
export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: any) {
    super(message);
  }
}

const messageOf = (body: any, fallback: string) => {
  const m = body?.message;
  if (Array.isArray(m)) return m[0];
  if (typeof m === 'string') return m;
  return fallback;
};

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    ...rest,
    headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageOf(body, res.statusText), body);
  return body as T;
}

/** SWR fetcher: 401 resolves to null so "not logged in" isn't an error state. */
export const fetcher = async (path: string) => {
  try {
    return await api(path);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
};
