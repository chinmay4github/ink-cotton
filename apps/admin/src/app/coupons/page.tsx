'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@ic/ui/api';
import { PageHeader, Spinner, Status } from '@ic/ui/components';
import { date, inr } from '@ic/ui/format';
import { useAction } from '@ic/ui/staff';

interface Coupon {
  id: number; code: string; description: string | null; discountType: 'percentage' | 'flat'; discountValue: number; maxDiscount: number | null; minOrderAmount: number;
  usageLimit: number | null; perUserLimit: number; used: number; validFrom: string; validTo: string; isActive: boolean; seller: string | null; expired: boolean;
}

export default function Page() {
  const { data, mutate } = useSWR<Coupon[]>('/admin/coupons');
  const { busy, run } = useAction();
  const [f, setF] = useState({ code: '', description: '', discountType: 'percentage' as 'percentage' | 'flat', discountValue: 10, maxDiscount: '', minOrderAmount: 999, perUserLimit: 1, validDays: 30 });
  const create = (e: React.FormEvent) => {
    e.preventDefault();
    run('create', async () => {
      await api('/admin/coupons', { method: 'POST', json: { ...f, code: f.code.toUpperCase(), maxDiscount: f.maxDiscount ? Number(f.maxDiscount) : undefined, discountValue: Number(f.discountValue), minOrderAmount: Number(f.minOrderAmount), perUserLimit: Number(f.perUserLimit), validDays: Number(f.validDays) } });
      setF({ ...f, code: '', description: '' });
      await mutate();
    }, 'Coupon created. Shoppers can use it at checkout now.');
  };
  const toggle = (c: Coupon) => run(`t${c.id}`, async () => { await api(`/admin/coupons/${c.id}`, { method: 'PATCH', json: { isActive: !c.isActive } }); await mutate(); }, c.isActive ? 'Disabled' : 'Enabled');
  return (
    <>
      <PageHeader title="Coupons" eyebrow="Promotions" />
      <form onSubmit={create} className="card mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className="label" htmlFor="code">Code</label><input id="code" className="input uppercase" required pattern="[A-Za-z0-9]{4,20}" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="DIWALI25" /></div>
        <div className="sm:col-span-1 lg:col-span-3"><label className="label" htmlFor="desc">Description (shoppers see this)</label><input id="desc" className="input" required minLength={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="25% off festive wear, up to ₹500" /></div>
        <div><label className="label" htmlFor="type">Type</label><select id="type" className="input" value={f.discountType} onChange={(e) => setF({ ...f, discountType: e.target.value as any })}><option value="percentage">% off</option><option value="flat">₹ off</option></select></div>
        <div><label className="label" htmlFor="val">{f.discountType === 'percentage' ? 'Percent' : 'Amount (₹)'}</label><input id="val" type="number" min={1} className="input" value={f.discountValue} onChange={(e) => setF({ ...f, discountValue: Number(e.target.value) })} /></div>
        <div><label className="label" htmlFor="max">Max discount ₹ (optional)</label><input id="max" type="number" min={1} className="input" value={f.maxDiscount} onChange={(e) => setF({ ...f, maxDiscount: e.target.value })} /></div>
        <div><label className="label" htmlFor="min">Min order ₹</label><input id="min" type="number" min={0} className="input" value={f.minOrderAmount} onChange={(e) => setF({ ...f, minOrderAmount: Number(e.target.value) })} /></div>
        <div><label className="label" htmlFor="pu">Uses per customer</label><input id="pu" type="number" min={1} className="input" value={f.perUserLimit} onChange={(e) => setF({ ...f, perUserLimit: Number(e.target.value) })} /></div>
        <div><label className="label" htmlFor="days">Valid for (days)</label><input id="days" type="number" min={1} max={365} className="input" value={f.validDays} onChange={(e) => setF({ ...f, validDays: Number(e.target.value) })} /></div>
        <div className="flex items-end sm:col-span-2"><button className="btn-primary" disabled={!!busy}>{busy === 'create' && <Spinner />} Create coupon</button></div>
      </form>
      {!data && <div className="skeleton h-40" />}
      {data && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-paper-warm text-left text-xs uppercase tracking-wider text-ink-mute"><tr><th className="px-4 py-3">Code</th><th className="px-4 py-3">Offer</th><th className="px-4 py-3">Used</th><th className="px-4 py-3">Valid until</th><th className="px-4 py-3">Status</th><th /></tr></thead>
            <tbody className="divide-y divide-paper-line">
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                  <td className="px-4 py-3">{c.discountType === 'percentage' ? `${c.discountValue}% off` : `${inr(c.discountValue)} off`}{c.maxDiscount ? ` (max ${inr(c.maxDiscount)})` : ''}<span className="block text-xs text-ink-mute">{c.description} · min {inr(c.minOrderAmount)}{c.seller ? ` · ${c.seller} only` : ''}</span></td>
                  <td className="px-4 py-3 tabular-nums">{c.used}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                  <td className="px-4 py-3">{date(c.validTo)}</td>
                  <td className="px-4 py-3"><Status status={c.expired ? 'cancelled' : c.isActive ? 'active' : 'inactive'} label={c.expired ? 'Expired' : c.isActive ? 'Active' : 'Disabled'} /></td>
                  <td className="px-4 py-3 text-right">{!c.expired && <button className="text-xs font-semibold underline" disabled={!!busy} onClick={() => toggle(c)}>{c.isActive ? 'Disable' : 'Enable'}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
