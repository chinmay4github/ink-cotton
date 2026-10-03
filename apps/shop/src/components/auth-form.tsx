'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { useAuth } from './providers';
import { Spinner } from './ui';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const auth = useAuth();
  const next = useSearchParams().get('next') || '/';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const [f, setF] = useState({ fullName: '', email: '', phone: '', password: '', identifier: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'login') await auth.login(f.identifier, f.password);
      else await auth.register({ fullName: f.fullName, email: f.email, phone: f.phone || undefined, password: f.password });
      // Hard navigation: the client router may hold a cached middleware redirect (e.g. /checkout -> /login)
      // from before login, and server components must re-render with the new session cookie.
      window.location.assign(safeNext);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <div className="container-page grid min-h-[70vh] place-items-center py-12">
      <div className="w-full max-w-md">
        <p className="eyebrow text-center">{mode === 'login' ? 'Welcome back' : 'Join Ink & Cotton'}</p>
        <h1 className="mt-2 text-center font-display text-4xl">{mode === 'login' ? 'Log in' : 'Create your account'}</h1>
        <form onSubmit={submit} className="card mt-8 space-y-4 p-7">
          {mode === 'register' && (
            <>
              <div><label className="label" htmlFor="fn">Full name</label><input id="fn" className="input" required value={f.fullName} onChange={set('fullName')} autoComplete="name" /></div>
              <div><label className="label" htmlFor="em">Email</label><input id="em" type="email" className="input" required value={f.email} onChange={set('email')} autoComplete="email" /></div>
              <div><label className="label" htmlFor="ph">Mobile (optional)</label><input id="ph" className="input" inputMode="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" /></div>
            </>
          )}
          {mode === 'login' && (
            <div><label className="label" htmlFor="id">Email or mobile</label><input id="id" className="input" required value={f.identifier} onChange={set('identifier')} autoComplete="username" /></div>
          )}
          <div>
            <label className="label" htmlFor="pw">Password</label>
            <input id="pw" type="password" className="input" required minLength={mode === 'register' ? 8 : 1} value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            {mode === 'register' && <p className="mt-1.5 text-xs text-ink-mute">At least 8 characters, with a letter and a number.</p>}
          </div>
          {err && <p className="rounded-lg bg-clay-tint px-3 py-2 text-sm text-clay-dark">{err}</p>}
          <button className="btn-primary w-full py-3.5" disabled={busy}>{busy && <Spinner />} {mode === 'login' ? 'Log in' : 'Create account'}</button>
          {mode === 'login' && (
            <button type="button" onClick={() => setF({ ...f, identifier: 'demo@inkandcotton.test', password: 'Password@123' })} className="w-full rounded-xl border border-dashed border-paper-line px-3 py-2.5 text-xs text-ink-soft hover:border-ink">
              Use demo customer: <b>demo@inkandcotton.test</b> / Password@123
            </button>
          )}
        </form>
        <p className="mt-6 text-center text-sm text-ink-soft">
          {mode === 'login' ? <>New to Ink &amp; Cotton? <Link href={`/register?next=${encodeURIComponent(safeNext)}`} className="font-semibold text-ink underline">Create an account</Link></> : <>Already have an account? <Link href={`/login?next=${encodeURIComponent(safeNext)}`} className="font-semibold text-ink underline">Log in</Link></>}
        </p>
      </div>
    </div>
  );
}
