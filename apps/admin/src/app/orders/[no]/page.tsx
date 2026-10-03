'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@ic/ui/api';
import { Address, PageHeader, Spinner, Status, Thumb } from '@ic/ui/components';
import { date, inr } from '@ic/ui/format';
import { useAction } from '@ic/ui/staff';

interface Detail {
  orderNumber: string; status: string; placedAt: string; paymentMethod: string; shippingAddress: any; coupon: string | null; cancelReason: string | null;
  amounts: { subtotal: number; discount: number; shipping: number; tax: number; total: number };
  payment: { status: string; method: string } | null; canCancel: boolean;
  customer: { name: string; email: string | null; phone: string | null };
  items: { id: number; name: string; sku: string; color: string; size: string; image: string | null; quantity: number; total: number; status: string }[];
  shipments: {
    id: number; trackingNumber: string; seller: string; status: string; estimatedDelivery: string | null; itemIds: number[];
    agent: { name: string; phone: string | null } | null; events: { status: string; description: string | null; location: string | null; at: string }[];
  }[];
}
interface Rider { id: number; name: string; status: string; isAvailable: boolean; activeJobs: number; vehicleType: string | null }

export default function Page() {
  const { no } = useParams<{ no: string }>();
  const { data: o, mutate } = useSWR<Detail>(`/admin/orders/${no}`);
  const { data: riders } = useSWR<Rider[]>('/admin/riders?status=approved');
  const { busy, run } = useAction();
  const [pick, setPick] = useState<Record<number, string>>({});
  if (!o) return <div className="skeleton h-96" />;
  const byId = new Map(o.items.map((i) => [i.id, i]));

  const assign = (sid: number) =>
    run(`a${sid}`, async () => {
      await api(`/admin/shipments/${sid}/assign`, { method: 'POST', json: { agentId: Number(pick[sid]) } });
      await mutate();
    }, 'Rider assigned');
  const cancel = () => {
    const reason = prompt('Reason for cancelling (shown to the customer)');
    if (reason !== null) run('cancel', async () => { await api(`/admin/orders/${o.orderNumber}/cancel`, { method: 'POST', json: { reason: reason || undefined } }); await mutate(); }, 'Order cancelled');
  };

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/orders" className="text-ink-mute hover:text-ink">← Orders</Link></p>
      <PageHeader title={o.orderNumber} eyebrow={`Placed ${date(o.placedAt, true)}`} actions={o.canCancel && <button className="btn-outline" onClick={cancel} disabled={!!busy}>{busy === 'cancel' && <Spinner />} Cancel order</button>}>
        <div className="mt-3 flex items-center gap-2"><Status status={o.status} />{o.cancelReason && <span className="text-sm text-ink-mute">{o.cancelReason}</span>}</div>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {o.shipments.map((s) => (
            <section key={s.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="text-sm font-semibold">{s.seller}</p><p className="text-xs text-ink-mute">{s.trackingNumber}{s.agent ? ` · Rider ${s.agent.name} (${s.agent.phone})` : ''}</p></div>
                <Status status={s.status} />
              </div>
              <ul className="mt-4 space-y-2">
                {s.itemIds.map((id) => byId.get(id)).filter(Boolean).map((i) => (
                  <li key={i!.id} className="flex items-center gap-3"><Thumb src={i!.image} /><span className="flex-1 text-sm">{i!.name}<span className="block text-xs text-ink-mute">{i!.color} · {i!.size} · × {i!.quantity} · {i!.sku}</span></span><span className="text-sm">{inr(i!.total)}</span></li>
                ))}
              </ul>
              {s.status === 'created' && (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-paper-warm p-3">
                  <select className="input w-auto flex-1 bg-white" value={pick[s.id] ?? ''} onChange={(e) => setPick({ ...pick, [s.id]: e.target.value })} aria-label="Choose a rider">
                    <option value="">Assign a rider…</option>
                    {riders?.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.isAvailable ? 'online' : 'offline'} · {r.activeJobs} active</option>)}
                  </select>
                  <button className="btn-primary px-4 py-2.5" disabled={!pick[s.id] || !!busy} onClick={() => assign(s.id)}>{busy === `a${s.id}` && <Spinner />} Assign</button>
                </div>
              )}
              <ol className="mt-4 space-y-2 border-l border-paper-line pl-4">
                {s.events.map((e, k) => (
                  <li key={k} className="text-xs"><b className="text-ink">{e.description ?? e.status}</b> <span className="text-ink-mute">· {date(e.at, true)}{e.location ? ` · ${e.location}` : ''}</span></li>
                ))}
              </ol>
            </section>
          ))}
        </div>
        <aside className="space-y-4">
          <div className="card p-5 text-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em]">Customer</p>
            <p className="font-semibold">{o.customer.name}</p><p className="text-ink-soft">{o.customer.email}</p><p className="text-ink-soft">{o.customer.phone}</p>
            <div className="mt-3 border-t border-paper-line pt-3"><Address a={o.shippingAddress} /></div>
          </div>
          <div className="card space-y-1.5 p-5 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]">Payment</p>
            <div className="flex justify-between"><span className="text-ink-soft">Items</span><span>{inr(o.amounts.subtotal)}</span></div>
            {o.amounts.discount > 0 && <div className="flex justify-between"><span className="text-ink-soft">Coupon {o.coupon}</span><span className="text-leaf">− {inr(o.amounts.discount)}</span></div>}
            <div className="flex justify-between"><span className="text-ink-soft">Delivery</span><span>{o.amounts.shipping ? inr(o.amounts.shipping) : 'Free'}</span></div>
            <div className="flex justify-between border-t border-paper-line pt-2 font-semibold"><span>Total</span><span>{inr(o.amounts.total)}</span></div>
            <p className="pt-1 text-xs uppercase text-ink-mute">{o.paymentMethod} · {o.payment?.status}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
