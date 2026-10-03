'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import useSWR from 'swr';
import { Empty, PageHeader, Status } from '@ic/ui/components';
import { inr, relative } from '@ic/ui/format';

interface Row {
  orderNumber: string; status: string; placedAt: string; customer: string; total: number; paymentMethod: string; city: string; items: number;
  shipments: { id: number; status: string; packed: boolean; assigned: boolean; seller: string; trackingNumber: string }[];
}
const STATUSES = ['', 'confirmed', 'processing', 'shipped', 'partially_shipped', 'delivered', 'pending', 'cancelled', 'refunded'];

function Orders() {
  const sp = useSearchParams();
  const router = useRouter();
  const status = sp.get('status') ?? '';
  const page = Number(sp.get('page') ?? 1);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const qs = new URLSearchParams({ ...(status && { status }), ...(sp.get('q') && { q: sp.get('q')! }), page: String(page) });
  const { data } = useSWR<{ items: Row[]; total: number; page: number; totalPages: number }>(`/admin/orders?${qs}`, { refreshInterval: 20_000 });
  const go = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!('page' in patch)) n.delete('page');
    router.push(`/orders?${n}`);
  };

  return (
    <>
      <PageHeader title="Orders" eyebrow={`${data?.total ?? '…'} orders`} />
      <div className="mb-4 flex flex-wrap gap-2">
        <form onSubmit={(e) => { e.preventDefault(); go({ q }); }} className="flex-1"><input className="input max-w-sm" placeholder="Order number or customer name" value={q} onChange={(e) => setQ(e.target.value)} /></form>
        <select className="input w-auto" value={status} onChange={(e) => go({ status: e.target.value })} aria-label="Filter by status">
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All statuses'}</option>)}
        </select>
      </div>
      {!data && <div className="skeleton h-80" />}
      {data?.items.length === 0 && <Empty title="No orders match" />}
      {data && data.items.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-paper-warm text-left text-xs uppercase tracking-wider text-ink-mute">
              <tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Fulfilment</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-paper-line">
              {data.items.map((o) => (
                <tr key={o.orderNumber} className="hover:bg-paper/60">
                  <td className="px-4 py-3"><Link href={`/orders/${o.orderNumber}`} className="font-semibold hover:underline">{o.orderNumber}</Link><span className="block text-xs text-ink-mute">{relative(o.placedAt)}</span></td>
                  <td className="px-4 py-3">{o.customer}<span className="block text-xs text-ink-mute">{o.city}</span></td>
                  <td className="px-4 py-3">{inr(o.total)}<span className="block text-xs uppercase text-ink-mute">{o.paymentMethod} · {o.items} item{o.items === 1 ? '' : 's'}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {o.shipments.map((s) => <Status key={s.id} status={s.status} label={s.status === 'created' ? (s.packed ? 'Packed · no rider' : 'Seller packing') : undefined} />)}
                      {o.shipments.length === 0 && <span className="text-xs text-ink-mute">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3"><Status status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button className="btn-outline px-4 py-2" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })}>Previous</button>
          <span>Page {page} of {data.totalPages}</span>
          <button className="btn-outline px-4 py-2" disabled={page >= data.totalPages} onClick={() => go({ page: String(page + 1) })}>Next</button>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return <Suspense><Orders /></Suspense>;
}
