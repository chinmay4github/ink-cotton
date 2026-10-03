'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { DailyBars, RankBars } from '@ic/ui/charts';
import { Kpi, PageHeader, Status } from '@ic/ui/components';
import { inr } from '@ic/ui/format';

interface Overview {
  kpis: {
    gmv: number; orders: number; aov: number; customers: number; sellersApproved: number; sellersPending: number; ridersApproved: number;
    ridersPending: number; ridersOnline: number; productsActive: number; productsPending: number; awaitingPickup: number; inTransit: number; returnsOpen: number;
  };
  ordersByStatus: { status: string; count: number }[];
  daily: { date: string; orders: number; revenue: number }[];
  topProducts: { name: string; units: number; revenue: number }[];
}

export default function Page() {
  const { data } = useSWR<Overview>('/admin/overview', { refreshInterval: 30_000 });
  if (!data) return <div className="skeleton h-96" />;
  const k = data.kpis;
  const todo = [
    { n: k.sellersPending, label: k.sellersPending === 1 ? 'seller application' : 'seller applications', href: '/sellers' },
    { n: k.ridersPending, label: k.ridersPending === 1 ? 'rider application' : 'rider applications', href: '/riders' },
    { n: k.productsPending, label: k.productsPending === 1 ? 'product to review' : 'products to review', href: '/products' },
    { n: k.returnsOpen, label: k.returnsOpen === 1 ? 'return request' : 'return requests', href: '/returns' },
  ].filter((t) => t.n > 0);

  return (
    <>
      <PageHeader title="Overview" eyebrow="Ink & Cotton" />
      {todo.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {todo.map((t) => (
            <Link key={t.href} href={t.href} className="rounded-full bg-ink px-4 py-2 text-sm text-white hover:bg-ink-soft"><b>{t.n}</b> {t.label} →</Link>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Gross sales" value={inr(k.gmv)} hint={`${k.orders} paid orders · AOV ${inr(k.aov)}`} />
        <Kpi label="Customers" value={k.customers} />
        <Kpi label="Awaiting pickup" value={k.awaitingPickup} hint={`${k.inTransit} on the road`} tone={k.awaitingPickup ? 'warn' : undefined} />
        <Kpi label="Riders online" value={`${k.ridersOnline} / ${k.ridersApproved}`} hint={`${k.sellersApproved} sellers · ${k.productsActive} live products`} tone="good" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <DailyBars title="Orders" data={data.daily.map((d) => ({ date: d.date, value: d.orders }))} />
        <DailyBars title="Revenue (₹)" data={data.daily.map((d) => ({ date: d.date, value: d.revenue }))} format={(v) => inr(v)} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <RankBars title="Top products" rows={data.topProducts.map((p) => ({ label: p.name, value: p.revenue, note: `${p.units} unit${p.units === 1 ? "" : "s"}` }))} format={(v) => inr(v)} />
        <div className="card p-5">
          <p className="mb-4 text-sm font-semibold">Orders by status</p>
          <ul className="space-y-2">
            {data.ordersByStatus.sort((a, b) => b.count - a.count).map((s) => (
              <li key={s.status}>
                <Link href={`/orders?status=${s.status}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-paper-warm"><Status status={s.status} /><span className="font-semibold tabular-nums">{s.count}</span></Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
