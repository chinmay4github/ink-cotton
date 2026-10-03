'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError } from '@ic/ui/api';
import { Spinner } from '@ic/ui/components';
import { Wordmark } from '@ic/ui/staff';

export default function Apply() {
  const [f, setF] = useState({ fullName: '', email: '', phone: '', password: '', vehicleType: 'bike', vehicleNumber: '', licenseNumber: '', pincodes: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const pincodes = f.pincodes.split(/[\s,]+/).filter(Boolean);
      await api('/rider/register', { method: 'POST', json: { ...f, pincodes, licenseNumber: f.licenseNumber || undefined } });
      window.location.assign('/');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };
  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className="label" htmlFor={k}>{label}</label><input id={k} className="input" value={f[k]} onChange={set(k)} {...props} /></div>
  );
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Link href="/login"><Wordmark app="Deliver" /></Link>
      <h1 className="mt-10 font-display text-4xl">Become a delivery partner</h1>
      <p className="mt-2 text-sm text-ink-soft">Earn ₹45 per delivery and ₹30 per return pickup, on your own schedule.</p>
      <form onSubmit={submit} className="card mt-8 space-y-4 p-6">
        {field('fullName', 'Full name', { required: true, autoComplete: 'name' })}
        <div className="grid gap-4 sm:grid-cols-2">
          {field('phone', 'Mobile', { required: true, inputMode: 'tel' })}
          {field('email', 'Email', { required: true, type: 'email' })}
        </div>
        {field('password', 'Password', { required: true, type: 'password', minLength: 8, autoComplete: 'new-password' })}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="vt">Vehicle</label>
            <select id="vt" className="input" value={f.vehicleType} onChange={set('vehicleType')}>
              {['bike', 'scooter', 'cycle', 'van', 'truck'].map((v) => <option key={v} value={v} className="capitalize">{v}</option>)}
            </select>
          </div>
          {field('vehicleNumber', 'Vehicle number', { required: true, placeholder: 'KA01AB1234', className: 'input uppercase' })}
        </div>
        {field('licenseNumber', 'Driving licence (optional)')}
        {field('pincodes', 'PIN codes you can cover', { placeholder: '560102, 560034' })}
        {err && <p className="rounded-lg bg-clay-tint px-3 py-2 text-sm text-clay-dark">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner />} Submit application</button>
      </form>
    </div>
  );
}
