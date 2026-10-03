'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Address } from '@/lib/types';
import { Spinner } from './ui';

const STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];

export function AddressForm({ initial, onSaved, onCancel }: { initial?: Address; onSaved: (a: Address) => void; onCancel?: () => void }) {
  const [f, setF] = useState({
    contactName: initial?.contact_name ?? '', contactPhone: initial?.contact_phone ?? '', line1: initial?.line1 ?? '', line2: initial?.line2 ?? '',
    landmark: initial?.landmark ?? '', city: initial?.city ?? '', state: initial?.state ?? '', postalCode: initial?.postal_code ?? '',
    type: initial?.type ?? 'home', isDefault: initial?.is_default ?? false,
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body = { ...f, line2: f.line2 || undefined, landmark: f.landmark || undefined };
      const a = await api<Address>(initial ? `/addresses/${initial.id}` : '/addresses', { method: initial ? 'PATCH' : 'POST', json: body });
      onSaved(a);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not save address');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div><label className="label" htmlFor="an">Full name</label><input id="an" className="input" required value={f.contactName} onChange={set('contactName')} autoComplete="name" /></div>
      <div><label className="label" htmlFor="ap">Mobile number</label><input id="ap" className="input" required inputMode="tel" value={f.contactPhone} onChange={set('contactPhone')} autoComplete="tel" placeholder="10-digit mobile" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="a1">Flat, house no., building</label><input id="a1" className="input" required value={f.line1} onChange={set('line1')} autoComplete="address-line1" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="a2">Area, street, sector</label><input id="a2" className="input" value={f.line2} onChange={set('line2')} autoComplete="address-line2" /></div>
      <div><label className="label" htmlFor="al">Landmark (optional)</label><input id="al" className="input" value={f.landmark} onChange={set('landmark')} /></div>
      <div><label className="label" htmlFor="az">PIN code</label><input id="az" className="input" required inputMode="numeric" maxLength={6} value={f.postalCode} onChange={set('postalCode')} autoComplete="postal-code" /></div>
      <div><label className="label" htmlFor="ac">City</label><input id="ac" className="input" required value={f.city} onChange={set('city')} autoComplete="address-level2" /></div>
      <div>
        <label className="label" htmlFor="as">State</label>
        <select id="as" className="input" required value={f.state} onChange={set('state')}>
          <option value="">Select state</option>
          {STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        {(['home', 'work', 'other'] as const).map((t) => (
          <button type="button" key={t} onClick={() => setF({ ...f, type: t })} className={`chip capitalize ${f.type === t ? 'border-ink bg-ink text-white' : ''}`}>{t}</button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" className="accent-ink" checked={f.isDefault} onChange={(e) => setF({ ...f, isDefault: e.target.checked })} /> Make default</label>
      </div>
      {err && <p className="text-sm text-clay sm:col-span-2">{err}</p>}
      <div className="flex gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Save address</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

export function AddressText({ a }: { a: Pick<Address, 'contact_name' | 'contact_phone' | 'line1' | 'line2' | 'landmark' | 'city' | 'state' | 'postal_code'> }) {
  return (
    <div className="text-sm leading-relaxed text-ink-soft">
      <p className="font-semibold text-ink">{a.contact_name}</p>
      <p>{[a.line1, a.line2, a.landmark].filter(Boolean).join(', ')}</p>
      <p>{a.city}, {a.state} {a.postal_code}</p>
      <p className="mt-1">Mobile: {a.contact_phone}</p>
    </div>
  );
}
