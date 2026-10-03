'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { DailyBars, RankBars } from '@ic/ui/charts';
import { Kpi, PageHeader } from '@ic/ui/components';
import { inr } from '@ic/ui/format';
import { Gate, useSeller } from '@/lib/gate';
import { SHOP_URL } from '@/lib/app';

interface Overview {
  kpis: { revenue: number; unitsSold: number; netEarnings: number; toPack: number; shipping: number; activeProducts: number; pendingProducts: number; lowStock: number; openReturns: number };
  daily: { date: string; revenue: number; units: number }[];
  topProducts: { name: string; units: number; revenue: number }[];
}

function Dashboard() {
  const { data: s } = useSeller();
  const { data } = useSWR<Overview>('/seller/overview', { refreshInterval: 30_000 });
  if (!data || !s) return <div className="skeleton h-96" />;
  const k = data.kpis;
  return (
    <>
      <PageHeader eyebrow={s.displayName} title="Overview" actions={<><Link href="/products/new" className="btn-primary">Add product</Link><a href={`${SHOP_URL}`} target="_blank" className="btn-outline">View shop</a></>} />

      {k.toPack > 0 && (
        <Link href="/orders" className="mb-6 flex items-center justify-between gap-4 rounded-2xl bg-ink px-5 py-4 text-white">
          <span><b>{k.toPack} order{k.toPack === 1 ? '' : 's'}</b> waiting to be packed. Riders can only pick up packed orders.</span>
          <span className="shrink-0 text-sm font-semibold underline">Pack now</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Sales" value={inr(k.revenue)} hint={`${k.unitsSold} units sold`} />
        <Kpi label="Your earnings" value={inr(k.netEarnings)} hint={`after ${s.commissionPct}% commission`} tone="good" />
        <Kpi label="To pack" value={k.toPack} hint={`${k.shipping} on the way`} tone={k.toPack ? 'warn' : undefined} />
        <Kpi label="Live products" value={k.activeProducts} hint={k.pendingProducts ? `${k.pendingProducts} in review` : `${k.lowStock} sizes low on stock`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <DailyBars title="Sales (₹)" data={data.daily.map((d) => ({ date: d.date, value: d.revenue }))} format={(v) => inr(v)} />
        <RankBars title="Top products" rows={data.topProducts.map((p) => ({ label: p.name, value: p.revenue, note: `${p.units} unit${p.units === 1 ? "" : "s"}` }))} format={(v) => inr(v)} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link href="/products?filter=low" className="card p-5 hover:border-ink">
          <p className="text-sm font-semibold">Low stock</p>
          <p className="mt-1 text-sm text-ink-mute">{k.lowStock} sizes have 5 or fewer units.</p>
        </Link>
        <Link href="/returns" className="card p-5 hover:border-ink">
          <p className="text-sm font-semibold">Returns</p>
          <p className="mt-1 text-sm text-ink-mute">{k.openReturns ? `${k.openReturns} on the way back to you.` : 'No open returns.'}</p>
        </Link>
        <Link href="/payouts" className="card p-5 hover:border-ink">
          <p className="text-sm font-semibold">Payouts</p>
          <p className="mt-1 text-sm text-ink-mute">See earnings, commission and settlements.</p>
        </Link>
      </div>
    </>
  );
}

export default function Page() {
  return <Gate><Dashboard /></Gate>;
}
