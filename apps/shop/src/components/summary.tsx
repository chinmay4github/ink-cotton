'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { inr } from '@/lib/format';
import type { Coupon, CartQuote } from '@/lib/types';
import { TagIcon, XIcon } from './icons';
import { useAuth, useBag } from './providers';

export function CouponBox() {
  const bag = useBag();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [show, setShow] = useState(false);
  const { data: coupons } = useSWR<Coupon[]>(user?.role === 'customer' ? '/cart/coupons' : null);
  const q = bag.quote;

  if (!user) return <p className="rounded-xl bg-paper-warm px-4 py-3 text-xs text-ink-soft"><TagIcon size={14} className="mr-1 inline" /> Log in to apply coupons like <b>WELCOME10</b>.</p>;

  if (q?.coupon)
    return (
      <div className="flex items-center justify-between rounded-xl border border-dashed border-leaf bg-leaf-tint px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-leaf">{q.coupon.code} applied</p>
          <p className="text-xs text-leaf/80">You save {inr(q.couponDiscount)}</p>
        </div>
        <button onClick={() => bag.setCoupon(null)} className="p-1 text-leaf" aria-label="Remove coupon"><XIcon size={16} /></button>
      </div>
    );

  return (
    <div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) bag.setCoupon(code.trim().toUpperCase()); }}>
        <input className="input py-2.5 uppercase" placeholder="Coupon code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Coupon code" />
        <button className="btn-outline px-5 py-2">Apply</button>
      </form>
      {bag.coupon && q?.couponError && <p className="mt-2 text-xs text-clay">{q.couponError}</p>}
      {!!coupons?.length && (
        <button onClick={() => setShow(!show)} className="mt-3 text-xs font-semibold underline">{show ? 'Hide' : 'View'} available coupons ({coupons.length})</button>
      )}
      {show && (
        <ul className="mt-3 space-y-2">
          {coupons!.map((c) => {
            const eligible = (q?.subtotal ?? 0) >= c.minOrderAmount;
            return (
              <li key={c.code} className="flex items-center justify-between gap-3 rounded-xl border border-paper-line bg-white px-3 py-2.5">
                <div>
                  <p className="font-mono text-xs font-bold tracking-wider">{c.code}</p>
                  <p className="text-xs text-ink-mute">{c.description}</p>
                </div>
                <button disabled={!eligible} onClick={() => { setCode(c.code); bag.setCoupon(c.code); setShow(false); }} className="text-xs font-semibold text-clay disabled:text-ink-mute">
                  {eligible ? 'Apply' : `Min ${inr(c.minOrderAmount)}`}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function PriceSummary({ q }: { q: CartQuote }) {
  const Row = ({ l, v, tone }: { l: string; v: string; tone?: string }) => (
    <div className="flex justify-between text-sm"><span className="text-ink-soft">{l}</span><span className={tone}>{v}</span></div>
  );
  return (
    <div className="space-y-3">
      <Row l={`Total MRP (${q.itemCount} item${q.itemCount === 1 ? '' : 's'})`} v={inr(q.mrpTotal)} />
      {q.productDiscount > 0 && <Row l="Discount on MRP" v={`− ${inr(q.productDiscount)}`} tone="text-leaf" />}
      {q.couponDiscount > 0 && <Row l={`Coupon (${q.coupon?.code})`} v={`− ${inr(q.couponDiscount, true)}`} tone="text-leaf" />}
      <Row l="Delivery" v={q.shipping ? inr(q.shipping) : 'FREE'} tone={q.shipping ? '' : 'text-leaf font-semibold'} />
      <div className="flex justify-between border-t border-paper-line pt-3 text-base font-semibold"><span>Total</span><span>{inr(q.total, true)}</span></div>
      <p className="text-xs text-ink-mute">Includes GST of {inr(q.tax, true)}</p>
      {q.productDiscount + q.couponDiscount > 0 && (
        <p className="rounded-lg bg-leaf-tint px-3 py-2 text-center text-xs font-semibold text-leaf">You save {inr(q.productDiscount + q.couponDiscount, true)} on this order</p>
      )}
    </div>
  );
}
