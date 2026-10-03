'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError } from '@ic/ui/api';
import { Spinner } from '@ic/ui/components';
import { Wordmark } from '@ic/ui/staff';

const STATES = ['Andhra Pradesh', 'Delhi', 'Gujarat', 'Haryana', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'West Bengal'];

export default function Apply() {
  const [f, setF] = useState({ fullName: '', email: '', phone: '', password: '', businessName: '', displayName: '', gstin: '', line1: '', city: '', state: 'Karnataka', postalCode: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api('/seller/register', { method: 'POST', json: { ...f, gstin: f.gstin.trim().toUpperCase() || undefined } });
      window.location.assign('/');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className="label" htmlFor={k}>{label}</label><input id={k} className="input" value={f[k]} onChange={set(k)} required {...props} /></div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/login"><Wordmark app="Sell" /></Link>
      <h1 className="mt-10 font-display text-4xl">Apply to sell</h1>
      <p className="mt-2 text-sm text-ink-soft">Tell us about your store. Our team reviews applications within one working day.</p>
      <form onSubmit={submit} className="mt-8 space-y-8">
        <section className="card space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Your account</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('fullName', 'Your name', { autoComplete: 'name' })}
            {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
            {field('phone', 'Mobile', { inputMode: 'tel', placeholder: '10-digit mobile' })}
            {field('password', 'Password', { type: 'password', minLength: 8, autoComplete: 'new-password' })}
          </div>
        </section>
        <section className="card space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Your store</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('businessName', 'Registered business name')}
            {field('displayName', 'Store name shoppers see')}
            <div><label className="label" htmlFor="gstin">GSTIN (optional)</label><input id="gstin" className="input uppercase" value={f.gstin} onChange={set('gstin')} maxLength={15} placeholder="15 characters" /></div>
          </div>
        </section>
        <section className="card space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Pickup address</h2>
          <p className="-mt-2 text-xs text-ink-mute">Riders collect packed orders from here.</p>
          {field('line1', 'Address')}
          <div className="grid gap-4 sm:grid-cols-3">
            {field('city', 'City')}
            <div><label className="label" htmlFor="state">State</label><select id="state" className="input" value={f.state} onChange={set('state')}>{STATES.map((s) => <option key={s}>{s}</option>)}</select></div>
            {field('postalCode', 'PIN code', { inputMode: 'numeric', maxLength: 6 })}
          </div>
        </section>
        {err && <p className="rounded-lg bg-clay-tint px-3 py-2 text-sm text-clay-dark">{err}</p>}
        <div className="flex flex-wrap items-center gap-4">
          <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Submit application</button>
          <Link href="/login" className="text-sm text-ink-soft underline">I already have a seller account</Link>
        </div>
      </form>
    </div>
  );
}
