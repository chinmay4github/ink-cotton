'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@ic/ui/api';
import { Address, Badge, Empty, PageHeader, Spinner, Status, Tabs, Thumb } from '@ic/ui/components';
import { date, inr, relative } from '@ic/ui/format';
import { useAction } from '@ic/ui/staff';
import { Gate } from '@/lib/gate';

type Tab = 'to_pack' | 'shipping' | 'delivered' | 'all';
interface Shipment {
  id: number; trackingNumber: string; status: string; packedAt: string | null; createdAt: string; deliveredAt: string | null;
  orderNumber: string; placedAt: string; paymentMethod: string; codAmount: number; customer: string; shipTo: any;
  rider: { name: string; phone: string } | null; lastEvent: { description: string; at: string } | null;
  items: { name: string; sku: string; color: string; size: string; image: string | null; quantity: number; total: number }[];
  value: number;
}

function Orders() {
  const [tab, setTab] = useState<Tab>('to_pack');
  const { data, mutate } = useSWR<Shipment[]>(`/seller/orders?tab=${tab}`, { refreshInterval: 20_000 });
  const { data: toPack } = useSWR<Shipment[]>('/seller/orders?tab=to_pack', { refreshInterval: 20_000 });
  const { busy, run } = useAction();

  const pack = (s: Shipment) =>
    run(`p${s.id}`, async () => {
      await api(`/seller/shipments/${s.id}/pack`, { method: 'POST' });
      await mutate();
    }, `Packed ${s.orderNumber}. Riders nearby have been notified.`);

  const unpacked = toPack?.filter((s) => !s.packedAt).length ?? 0;

  return (
    <>
      <PageHeader title="Orders" eyebrow="Fulfilment" />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'to_pack', label: 'To pack', count: unpacked },
          { value: 'shipping', label: 'On the way' },
          { value: 'delivered', label: 'Delivered' },
          { value: 'all', label: 'All' },
        ]}
      />
      <div className="mt-6 space-y-4">
        {!data && <div className="skeleton h-40" />}
        {data?.length === 0 && <Empty title={tab === 'to_pack' ? 'Nothing to pack' : 'No orders here yet'} body={tab === 'to_pack' ? 'New orders appear here the moment a customer checks out.' : undefined} />}
        {data?.map((s) => (
          <article key={s.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{s.orderNumber}</p>
                <p className="text-xs text-ink-mute">Placed {relative(s.placedAt)} · {s.customer} · Tracking {s.trackingNumber}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {s.paymentMethod === 'cod' ? <Badge tone="warn">COD {inr(s.codAmount)}</Badge> : <Badge tone="good">Prepaid</Badge>}
                {s.status === 'created' && s.packedAt ? <Status status="created" label="Packed · awaiting rider" /> : <Status status={s.status} />}
              </div>
            </div>
            <div className="mt-4 grid gap-5 md:grid-cols-[1fr_240px]">
              <ul className="space-y-3">
                {s.items.map((i) => (
                  <li key={i.sku} className="flex items-center gap-3">
                    <Thumb src={i.image} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.name}</p>
                      <p className="text-xs text-ink-mute">{i.color} · {i.size} · SKU {i.sku}</p>
                    </div>
                    <p className="text-sm">× {i.quantity}</p>
                  </li>
                ))}
              </ul>
              <div className="space-y-3 rounded-xl bg-paper-warm p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">Ship to</p>
                <Address a={s.shipTo} compact />
                {s.rider && <p className="text-xs text-ink-soft">Rider: <b>{s.rider.name}</b> · {s.rider.phone}</p>}
                {s.lastEvent && <p className="text-xs text-ink-mute">{s.lastEvent.description} · {relative(s.lastEvent.at)}</p>}
                {s.deliveredAt && <p className="text-xs font-semibold text-leaf">Delivered {date(s.deliveredAt)}</p>}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-paper-line pt-4">
              <p className="text-sm">Order value <b>{inr(s.value)}</b></p>
              {s.status === 'created' && !s.packedAt && (
                <button className="btn-primary" onClick={() => pack(s)} disabled={!!busy}>{busy === `p${s.id}` && <Spinner />} Mark as packed</button>
              )}
              {s.status === 'created' && s.packedAt && <p className="text-xs text-ink-mute">Packed {relative(s.packedAt)} · a rider will collect it soon</p>}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export default function Page() {
  return <Gate><Orders /></Gate>;
}
