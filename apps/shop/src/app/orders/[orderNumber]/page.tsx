'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import useSWR from 'swr';
import { CheckIcon, PackageIcon } from '@/components/icons';
import { useToast } from '@/components/providers';
import { ShipmentTracker } from '@/components/tracking';
import { Empty, Spinner, StatusBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { date, inr } from '@/lib/format';
import type { OrderDetail } from '@/lib/types';

const DEMO = process.env.NEXT_PUBLIC_DEMO_TOOLS === 'true';

function OrderView() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const placed = useSearchParams().get('placed');
  const toast = useToast();
  const { data: o, error, mutate } = useSWR<OrderDetail>(`/orders/${orderNumber}`, {
    // poll while something is moving so tracking updates live
    refreshInterval: (d) => (d && !['delivered', 'cancelled'].includes(d.status) ? 15_000 : 0),
  });
  const [busy, setBusy] = useState<string | null>(null);
  const { data: returns, mutate: mutateReturns } = useSWR<ReturnInfo[]>('/returns');

  if (error) return <Empty title="Order not found" action={<Link href="/orders" className="btn-primary">All orders</Link>} />;
  if (!o) return <div className="skeleton h-[480px]" />;

  const cancel = async () => {
    if (!confirm('Cancel this order? Prepaid amounts are refunded to the original payment method.')) return;
    setBusy('cancel');
    try {
      mutate(await api(`/orders/${o.orderNumber}/cancel`, { method: 'POST', json: { reason: 'Cancelled by customer' } }), false);
      toast('Order cancelled');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not cancel', 'err');
    }
    setBusy(null);
  };
  const advance = async (tn: string) => {
    setBusy(tn);
    try {
      await api(`/dev/shipments/${tn}/advance`, { method: 'POST' });
      await mutate();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Failed', 'err');
    }
    setBusy(null);
  };

  const failed = o.status === 'cancelled' && o.payment?.status === 'failed' && o.paymentMethod !== 'cod';
  const itemsById = new Map(o.items.map((i) => [i.id, i]));
  const returnFor = (id: number) => returns?.find((r) => r.item.id === id && r.orderNumber === o.orderNumber && r.status !== 'rejected');
  const onReturned = () => { mutate(); mutateReturns(); };

  return (
    <>
      {placed && !failed && o.status !== 'cancelled' && (
        <div className="mb-8 flex items-center gap-4 rounded-3xl bg-leaf-tint p-6 text-leaf">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-leaf text-white"><CheckIcon /></span>
          <div>
            <p className="font-display text-2xl text-ink">Thank you! Your order is confirmed.</p>
            <p className="text-sm">We’ve sent a confirmation to your notifications. You can track every package below.</p>
          </div>
        </div>
      )}
      {failed && placed && (
        <div className="mb-8 rounded-3xl bg-clay-tint p-6 text-clay-dark">
          <p className="font-display text-2xl text-ink">Payment didn’t go through</p>
          <p className="mt-1 text-sm">No money was taken. The items are back in stock. You can place the order again from your bag.</p>
          <Link href="/" className="btn-primary mt-4">Continue shopping</Link>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Order {o.orderNumber}</p>
          <h1 className="mt-2 font-display text-4xl">Placed {date(o.placedAt)}</h1>
          <div className="mt-3 flex items-center gap-3"><StatusBadge status={o.status} />{o.cancelReason && <span className="text-sm text-ink-mute">{o.cancelReason}</span>}</div>
        </div>
        <div className="flex gap-2">
          {o.canPay && <Link href={`/checkout/pay/${o.orderNumber}`} className="btn-accent">Complete payment</Link>}
          {o.canCancel && <button onClick={cancel} disabled={!!busy} className="btn-outline">{busy === 'cancel' && <Spinner />} Cancel order</button>}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {o.shipments.length === 0 && (
            <div className="card p-6">
              <p className="text-sm text-ink-soft">{o.status === 'pending' ? 'Waiting for payment. Stock is reserved for 30 minutes.' : 'No shipments.'}</p>
              <ul className="mt-4 divide-y divide-paper-line">
                {o.items.map((i) => <ItemRow key={i.id} i={i} />)}
              </ul>
            </div>
          )}
          {o.shipments.map((s, idx) => (
            <section key={s.id} className="card p-6">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold"><PackageIcon size={18} /> Package {idx + 1} of {o.shipments.length}</p>
                  <p className="text-xs text-ink-mute">Sold by {s.seller} · Tracking {s.trackingNumber}</p>
                </div>
                <p className="text-sm">
                  {s.status === 'delivered' && s.deliveredAt ? <span className="font-semibold text-leaf">Delivered {date(s.deliveredAt)}</span> : s.estimatedDelivery && s.status !== 'cancelled' ? <>Arriving by <b>{date(s.estimatedDelivery)}</b></> : null}
                </p>
              </div>
              <ShipmentTracker s={s} />
              <ul className="mt-6 divide-y divide-paper-line border-t border-paper-line">
                {s.itemIds.map((id) => itemsById.get(id)).filter(Boolean).map((i) => (
                  <ItemRow key={i!.id} i={i!} delivered={s.status === 'delivered'} orderNumber={o.orderNumber} ret={returnFor(i!.id)} onReturned={onReturned} />
                ))}
              </ul>
              {DEMO && !['delivered', 'cancelled', 'returned_to_vendor'].includes(s.status) && (
                <button onClick={() => advance(s.trackingNumber)} disabled={!!busy} className="mt-4 inline-flex items-center gap-2 rounded-full border border-dashed border-ink/30 px-4 py-2 text-xs font-semibold text-ink-soft hover:border-ink">
                  {busy === s.trackingNumber && <Spinner />} Demo: simulate next delivery step
                </button>
              )}
            </section>
          ))}
        </div>

        <aside className="space-y-5">
          <div className="card p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em]">Payment</h2>
            <div className="space-y-2 text-sm">
              <Row l="Items" v={inr(o.amounts.subtotal, true)} />
              {o.amounts.discount > 0 && <Row l={`Coupon${o.coupon ? ` (${o.coupon})` : ''}`} v={`− ${inr(o.amounts.discount, true)}`} tone="text-leaf" />}
              <Row l="Delivery" v={o.amounts.shipping ? inr(o.amounts.shipping) : 'FREE'} />
              <div className="flex justify-between border-t border-paper-line pt-2 font-semibold"><span>Total</span><span>{inr(o.amounts.total, true)}</span></div>
              <p className="text-xs text-ink-mute">Incl. GST {inr(o.amounts.tax, true)}</p>
              <p className="pt-2 text-xs">
                <span className="font-semibold uppercase">{o.paymentMethod}</span> ·{' '}
                <span className="capitalize">{o.payment?.status === 'initiated' && o.paymentMethod === 'cod' ? 'Pay on delivery' : o.payment?.status?.replace('_', ' ')}</span>
              </p>
            </div>
          </div>
          <div className="card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em]">Delivering to</h2>
            <div className="text-sm leading-relaxed text-ink-soft">
              <p className="font-semibold text-ink">{o.shippingAddress.name}</p>
              <p>{[o.shippingAddress.line1, o.shippingAddress.line2, o.shippingAddress.landmark].filter(Boolean).join(', ')}</p>
              <p>{o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.postalCode}</p>
              <p className="mt-1">{o.shippingAddress.phone}</p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function Row({ l, v, tone }: { l: string; v: string; tone?: string }) {
  return <div className="flex justify-between"><span className="text-ink-soft">{l}</span><span className={tone}>{v}</span></div>;
}

type ReturnInfo = { id: number; status: string; reasonLabel: string; refundAmount: number | null; orderNumber: string; item: { id: number } };

const REASONS: [string, string][] = [
  ['size_issue', 'Size or fit issue'],
  ['defective', 'Damaged or defective'],
  ['wrong_item', 'Wrong item received'],
  ['not_as_described', 'Not as described'],
  ['changed_mind', 'Changed my mind'],
];
const RETURN_STEP: Record<string, string> = {
  requested: 'Return requested · awaiting approval',
  approved: 'Return approved · pickup being scheduled',
  picked_up: 'Picked up · on its way back to the seller',
  completed: 'Returned · refund issued',
};

function ItemRow({ i, delivered, orderNumber, ret, onReturned }: {
  i: OrderDetail['items'][number]; delivered?: boolean; orderNumber?: string; ret?: ReturnInfo; onReturned?: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('size_issue');
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);
  const canReturn = delivered && i.status === 'delivered' && !ret && orderNumber;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/orders/${orderNumber}/items/${i.id}/return`, { method: 'POST', json: { reason, comments: comments || undefined } });
      toast('Return requested');
      setOpen(false);
      onReturned?.();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not request a return', 'err');
    }
    setBusy(false);
  };

  return (
    <li className="py-4">
      <div className="flex items-center gap-4">
        <Link href={`/p/${i.slug}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={i.image ?? ''} alt="" className="h-20 w-16 rounded-lg bg-paper-warm object-cover" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/p/${i.slug}`} className="text-sm font-medium hover:underline">{i.name}</Link>
          <p className="text-xs text-ink-mute">{i.color} · Size {i.size} · Qty {i.quantity}</p>
          {ret && (
            <p className={`mt-1 text-xs font-semibold ${ret.status === 'completed' ? 'text-leaf' : 'text-ink-soft'}`}>
              {RETURN_STEP[ret.status] ?? ret.status}{ret.status === 'completed' && ret.refundAmount ? ` · ${inr(ret.refundAmount)}` : ''}
            </p>
          )}
          {delivered && !ret && (
            <div className="mt-1 flex gap-3 text-xs font-semibold">
              <Link href={`/p/${i.slug}#reviews`} className="text-clay underline">Rate &amp; review</Link>
              {canReturn && <button onClick={() => setOpen((v) => !v)} className="text-ink underline">Return item</button>}
            </div>
          )}
        </div>
        <p className="text-sm font-semibold">{inr(i.total, true)}</p>
      </div>
      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl bg-paper-warm p-4">
          <p className="text-sm font-semibold">Why are you returning this?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {REASONS.map(([k, label]) => (
              <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm ${reason === k ? 'border-ink' : 'border-paper-line'}`}>
                <input type="radio" name={`reason-${i.id}`} value={k} checked={reason === k} onChange={() => setReason(k)} /> {label}
              </label>
            ))}
          </div>
          <textarea className="input min-h-[70px]" placeholder="Anything else? (optional)" value={comments} onChange={(e) => setComments(e.target.value)} maxLength={500} />
          <p className="text-xs text-ink-mute">Free pickup from your delivery address. Refund of {inr(i.total, true)} once the seller receives it.</p>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Request return</button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </li>
  );
}

export default function Page() {
  return <div className="container-page max-w-6xl py-10"><Suspense><OrderView /></Suspense></div>;
}
