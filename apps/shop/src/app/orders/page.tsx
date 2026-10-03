'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { ChevronRight } from '@/components/icons';
import { Empty, StatusBadge } from '@/components/ui';
import { date, inr } from '@/lib/format';
import type { OrderSummary, Paged } from '@/lib/types';

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSWR<Paged<OrderSummary>>(`/orders?page=${page}&limit=10`);

  return (
    <div className="container-page max-w-4xl py-10">
      <h1 className="font-display text-4xl">Your orders</h1>
      <div className="mt-8 space-y-4">
        {isLoading && [1, 2, 3].map((i) => <div key={i} className="skeleton h-36" />)}
        {data && !data.items.length && <Empty title="No orders yet" body="When you place an order, you can track it here." action={<Link href="/" className="btn-primary">Start shopping</Link>} />}
        {data?.items.map((o) => (
          <Link key={o.orderNumber} href={`/orders/${o.orderNumber}`} className="card block p-5 transition hover:shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <StatusBadge status={o.status} />
                <span className="text-sm text-ink-soft">
                  {o.status === 'delivered' && o.deliveredAt ? `Delivered on ${date(o.deliveredAt)}` : o.estimatedDelivery && !['cancelled', 'pending'].includes(o.status) ? `Arriving by ${date(o.estimatedDelivery)}` : `Placed ${date(o.placedAt)}`}
                </span>
              </div>
              <span className="inline-flex items-center text-sm font-semibold">{inr(o.total)} <ChevronRight size={16} /></span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              {o.items.map((it, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={it.image_url ?? ''} alt={it.product_name} className="h-20 w-16 rounded-lg bg-paper-warm object-cover" />
              ))}
              <div className="ml-2 min-w-0 text-sm">
                <p className="truncate font-medium">{o.items[0]?.product_name}{o.itemCount > 1 ? ` + ${o.itemCount - 1} more` : ''}</p>
                <p className="text-xs text-ink-mute">Order {o.orderNumber} · {o.paymentMethod.toUpperCase()}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {data && data.totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-outline">Previous</button>
          <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="btn-outline">Next</button>
        </div>
      )}
    </div>
  );
}
