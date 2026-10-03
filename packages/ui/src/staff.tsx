'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import useSWR, { SWRConfig } from 'swr';
import { api, ApiError, fetcher } from './api';
import { relative } from './format';
import { Spinner } from './components';

// ------------------------------------------------------------------ app config
export interface StaffApp {
  key: 'sell' | 'deliver' | 'admin';
  name: string; // "Sell"
  role: 'vendor' | 'delivery_agent' | 'admin';
  tagline: string;
  nav: { href: string; label: string; icon: IconName }[];
  demo?: { identifier: string; label: string }[];
  signupHref?: string;
  signupLabel?: string;
}

export interface Me { id: number; role: string; full_name: string; email: string | null; phone: string | null }

const Ctx = createContext<{ app: StaffApp; me?: Me | null; toast: (m: string, kind?: 'ok' | 'err') => void } | null>(null);
export const useStaff = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStaff outside StaffProvider');
  return c;
};
export const useToast = () => useStaff().toast;

/** Wrap the whole app: SWR, toasts, session. Public routes (login / apply) render without the shell. */
export function StaffProvider({ app, children, publicPaths = ['/login', '/register'] }: { app: StaffApp; children: React.ReactNode; publicPaths?: string[] }) {
  const [toasts, setToasts] = useState<{ id: number; m: string; kind: 'ok' | 'err' }[]>([]);
  const toast = useCallback((m: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, m, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  const path = usePathname();
  const isPublic = publicPaths.some((p) => path === p || path.startsWith(p + '/'));

  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true, shouldRetryOnError: false }}>
      <Session app={app} toast={toast} isPublic={isPublic}>{children}</Session>
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={clsx('pointer-events-auto animate-fade-up rounded-full px-5 py-3 text-sm font-medium text-white shadow-card', t.kind === 'err' ? 'bg-clay-dark' : 'bg-ink')}>{t.m}</div>
        ))}
      </div>
    </SWRConfig>
  );
}

function Session({ app, toast, isPublic, children }: { app: StaffApp; toast: (m: string, k?: 'ok' | 'err') => void; isPublic: boolean; children: React.ReactNode }) {
  const { data: me, isLoading } = useSWR<Me | null>('/auth/me');
  useEffect(() => {
    if (isPublic || isLoading) return;
    if (me === null || (me && me.role !== app.role)) window.location.assign(`/login?next=${encodeURIComponent(location.pathname)}`);
  }, [me, isLoading, isPublic, app.role]);

  if (isPublic) return <Ctx.Provider value={{ app, me, toast }}>{children}</Ctx.Provider>;
  if (!me || me.role !== app.role) {
    return <div className="grid min-h-screen place-items-center"><Spinner className="h-6 w-6 text-ink-mute" /></div>;
  }
  return (
    <Ctx.Provider value={{ app, me, toast }}>
      <Shell>{children}</Shell>
    </Ctx.Provider>
  );
}

export function Wordmark({ app, className }: { app: string; className?: string }) {
  return (
    <span className={clsx('inline-flex items-baseline gap-2', className)}>
      <span className="font-display text-[22px] font-semibold leading-none">Ink <span className="italic text-clay">&amp;</span> Cotton</span>
      <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">{app}</span>
    </span>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { app, me } = useStaff();
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.assign('/login');
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      {/* sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-paper-line bg-white px-4 py-6 lg:flex">
        <Link href="/" className="px-2"><Wordmark app={app.name} /></Link>
        <p className="mt-2 px-2 text-xs text-ink-mute">{app.tagline}</p>
        <nav className="mt-8 flex flex-col gap-0.5">
          {app.nav.map((n) => (
            <Link key={n.href} href={n.href} className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', active(n.href) ? 'bg-ink text-white' : 'text-ink-soft hover:bg-paper-warm hover:text-ink')}>
              <Icon name={n.icon} /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-paper-warm p-3">
          <p className="truncate text-sm font-semibold">{me?.full_name}</p>
          <p className="truncate text-xs text-ink-mute">{me?.email ?? me?.phone}</p>
          <button onClick={logout} className="mt-2 text-xs font-semibold text-clay hover:underline">Sign out</button>
        </div>
      </aside>

      <div className="min-w-0">
        {/* top bar */}
        <header className="sticky top-0 z-40 border-b border-paper-line bg-paper/90 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="lg:hidden"><Wordmark app={app.name} /></Link>
            <span className="hidden text-sm text-ink-mute lg:block">Hello, {me?.full_name?.split(' ')[0]}</span>
            <div className="flex items-center gap-1">
              <Bell />
              <button onClick={logout} className="rounded-full p-2 text-ink-soft hover:bg-paper-warm lg:hidden" aria-label="Sign out"><Icon name="logout" /></button>
            </div>
          </div>
          <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {app.nav.map((n) => (
              <Link key={n.href} href={n.href} className={clsx('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium', active(n.href) ? 'bg-ink text-white' : 'text-ink-soft')}>{n.label}</Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function Bell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: count, mutate: mc } = useSWR<{ unread: number }>('/notifications/unread-count', { refreshInterval: 20_000 });
  const { data, mutate } = useSWR<{ items: { id: number; title: string; body: string; createdAt: string; isRead: boolean; deepLink?: string | null }[] }>(open ? '/notifications?limit=12' : null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const unread = count?.unread ?? 0;
  const readAll = async () => {
    await api('/notifications/read-all', { method: 'POST' });
    mutate();
    mc();
  };
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-full p-2 text-ink-soft hover:bg-paper-warm" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
        <Icon name="bell" />
        {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-clay px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-paper-line bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-paper-line px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && <button onClick={readAll} className="text-xs font-semibold text-clay">Mark all read</button>}
          </div>
          <ul className="max-h-[60vh] divide-y divide-paper-line overflow-auto">
            {!data && <li className="p-4"><Spinner /></li>}
            {data?.items.length === 0 && <li className="p-4 text-sm text-ink-mute">You’re all caught up.</li>}
            {data?.items.map((n) => (
              <li key={n.id} className={clsx('px-4 py-3', !n.isRead && 'bg-clay-tint/40')}>
                <Link href={n.deepLink ?? '#'} onClick={() => setOpen(false)}>
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-xs text-ink-soft">{n.body}</p>
                  <p className="mt-1 text-[11px] text-ink-mute">{relative(n.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ login
export function StaffLogin({ title, intro, aside }: { title: string; intro: string; aside?: React.ReactNode }) {
  const { app } = useStaff();
  const [identifier, setId] = useState('');
  const [password, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api('/auth/login', { method: 'POST', json: { identifier, password, role: app.role } });
      const next = new URLSearchParams(location.search).get('next') ?? '/';
      window.location.assign(next.startsWith('/') && !next.startsWith('//') ? next : '/');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Wordmark app={app.name} />
        <div className="mx-auto my-auto w-full max-w-sm py-12">
          <h1 className="font-display text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-ink-soft">{intro}</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div><label className="label" htmlFor="id">Email or mobile</label><input id="id" className="input" required value={identifier} onChange={(e) => setId(e.target.value)} autoComplete="username" /></div>
            <div><label className="label" htmlFor="pw">Password</label><input id="pw" type="password" className="input" required value={password} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></div>
            {err && <p className="rounded-lg bg-clay-tint px-3 py-2 text-sm text-clay-dark">{err}</p>}
            <button className="btn-primary w-full py-3.5" disabled={busy}>{busy && <Spinner />} Sign in</button>
          </form>
          {app.demo && (
            <div className="mt-4 space-y-2">
              {app.demo.map((d) => (
                <button key={d.identifier} type="button" onClick={() => { setId(d.identifier); setPw('Password@123'); }} className="w-full rounded-xl border border-dashed border-paper-line px-3 py-2.5 text-left text-xs text-ink-soft hover:border-ink">
                  Demo {d.label}: <b>{d.identifier}</b> / Password@123
                </button>
              ))}
            </div>
          )}
          {app.signupHref && (
            <p className="mt-8 text-sm text-ink-soft">New here? <Link href={app.signupHref} className="font-semibold text-ink underline">{app.signupLabel}</Link></p>
          )}
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-ink lg:block">{aside}</div>
    </div>
  );
}

// ------------------------------------------------------------------ helpers
/** Run an API mutation with a busy flag + toast. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
      setBusy(key);
      try {
        const out = await fn();
        if (ok) toast(ok);
        return out;
      } catch (e) {
        toast(e instanceof ApiError ? e.message : 'Something went wrong', 'err');
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );
  return { busy, run };
}

// ------------------------------------------------------------------ icons
export type IconName = 'home' | 'box' | 'tag' | 'plus' | 'return' | 'wallet' | 'bell' | 'logout' | 'truck' | 'user' | 'store' | 'bike' | 'ticket' | 'list' | 'shield' | 'history' | 'chart';
const PATHS: Record<IconName, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  plus: 'M12 5v14M5 12h14',
  return: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-4',
  wallet: 'M3 7h18v12H3zM3 7l3-4h12l3 4M16 13h2',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  truck: 'M1 4h13v12H1zM14 9h4l3 3v4h-7M5.5 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  user: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  store: 'M3 9l1.5-5h15L21 9M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM5 13v8h14v-8',
  bike: 'M5.5 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM18.5 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM15 6h3l-3.5 7.5H5.5L9 7h4',
  ticket: 'M3 7a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4zM13 5v14',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  chart: 'M3 3v18h18M7 15v3M12 10v8M17 6v12',
};
export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
