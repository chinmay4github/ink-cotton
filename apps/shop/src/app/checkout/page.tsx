'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { AddressForm, AddressText } from '@/components/address-form';
import { CashIcon, CheckIcon, ShieldIcon } from '@/components/icons';
import { useAuth, useBag, useToast } from '@/components/providers';
import { CouponBox, PriceSummary } from '@/components/summary';
import { Empty, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { inr } from '@/lib/format';
import type { Address } from '@/lib/types';

const METHODS = [
  { id: 'upi', label: 'UPI', note: 'Google Pay, PhonePe, Paytm & more' },
  { id: 'card', label: 'Credit / Debit card', note: 'Visa, Mastercard, RuPay' },
  { id: 'netbanking', label: 'Net banking', note: 'All major banks' },
  { id: 'cod', label: 'Cash on delivery', note: 'Pay in cash or UPI at your door' },
] as const;

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="mb-5 flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.14em]">
        <span className={clsx('grid h-7 w-7 place-items-center rounded-full text-xs', done ? 'bg-leaf text-white' : 'bg-ink text-white')}>{done ? <CheckIcon size={14} /> : n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const bag = useBag();
  const toast = useToast();
  const router = useRouter();
  const { data: addresses, mutate } = useSWR<Address[]>(user ? '/addresses' : null);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('upi');
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (user === null) router.replace('/login?next=/checkout');
  }, [user, router]);
  useEffect(() => {
    if (addresses && !addressId) setAddressId(addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null);
    if (addresses && !addresses.length) setAdding(true);
  }, [addresses]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = bag.quote;
  if (!user || !q) return <div className="container-page py-10"><div className="skeleton h-96" /></div>;
  if (!q.lines.length) return <div className="container-page py-12"><Empty title="Nothing to check out" body="Your bag is empty." action={<Link href="/" className="btn-primary">Continue shopping</Link>} /></div>;

  const codBlocked = q.total > 50000;

  const place = async () => {
    if (!addressId) return toast('Choose a delivery address', 'err');
    setPlacing(true);
    try {
      const r = await api<{ orderNumber: string; payment: { required: boolean } }>('/orders', {
        method: 'POST',
        json: { addressId, paymentMethod: method, couponCode: q.coupon?.code },
      });
      bag.setCoupon(null);
      bag.reload();
      router.push(r.payment.required ? `/checkout/pay/${r.orderNumber}` : `/orders/${r.orderNumber}?placed=1`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not place order', 'err');
      bag.reload();
      setPlacing(false);
    }
  };

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-4xl">Checkout</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Step n={1} title="Delivery address" done={!!addressId && !adding}>
            {!adding && (
              <div className="grid gap-3 sm:grid-cols-2">
                {addresses?.map((a) => (
                  <label key={a.id} className={clsx('cursor-pointer rounded-2xl border-2 p-4 transition', addressId === a.id ? 'border-ink bg-paper' : 'border-paper-line hover:border-ink/40')}>
                    <div className="mb-2 flex items-center gap-2">
                      <input type="radio" name="addr" className="accent-ink" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                      <span className="rounded bg-paper-warm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">{a.type}</span>
                      {a.is_default && <span className="text-[10px] font-semibold uppercase text-ink-mute">Default</span>}
                    </div>
                    <AddressText a={a} />
                  </label>
                ))}
                <button onClick={() => setAdding(true)} className="grid min-h-32 place-items-center rounded-2xl border-2 border-dashed border-paper-line text-sm font-semibold text-ink-soft hover:border-ink">+ Add new address</button>
              </div>
            )}
            {adding && <AddressForm onSaved={async (a) => { await mutate(); setAddressId(a.id); setAdding(false); }} onCancel={addresses?.length ? () => setAdding(false) : undefined} />}
          </Step>

          <Step n={2} title="Payment">
            <div className="space-y-3">
              {METHODS.map((m) => {
                const disabled = m.id === 'cod' && codBlocked;
                return (
                  <label key={m.id} className={clsx('flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition', method === m.id ? 'border-ink bg-paper' : 'border-paper-line hover:border-ink/40', disabled && 'cursor-not-allowed opacity-50')}>
                    <input type="radio" name="pm" className="accent-ink" disabled={disabled} checked={method === m.id} onChange={() => setMethod(m.id)} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{m.label}</p>
                      <p className="text-xs text-ink-mute">{disabled ? 'Available for orders up to ₹50,000' : m.note}</p>
                    </div>
                    {m.id === 'cod' && <CashIcon className="text-ink-mute" />}
                  </label>
                );
              })}
            </div>
          </Step>

          <Step n={3} title={`Review items (${q.itemCount})`}>
            <ul className="divide-y divide-paper-line">
              {q.lines.map((l) => (
                <li key={l.variantId} className="flex items-center gap-4 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.image ?? ''} alt="" className="h-20 w-16 rounded-lg bg-paper-warm object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-ink-mute">{l.color.name} · Size {l.size} · Qty {l.quantity}</p>
                    {l.issue && <p className="text-xs font-semibold text-clay">Not available in this quantity</p>}
                  </div>
                  <p className="text-sm font-semibold">{inr(l.lineTotal)}</p>
                </li>
              ))}
            </ul>
          </Step>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-32 lg:self-start">
          <div className="card p-5"><CouponBox /></div>
          <div className="card p-5">
            <PriceSummary q={q} />
            <button onClick={place} disabled={placing || !addressId || q.hasIssues} className="btn-accent mt-5 w-full py-4">
              {placing && <Spinner />} {method === 'cod' ? `Place order · ${inr(q.total)}` : `Pay ${inr(q.total)}`}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-mute"><ShieldIcon size={14} /> 100% secure checkout</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
