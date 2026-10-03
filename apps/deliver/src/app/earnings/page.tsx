'use client';

import useSWR from 'swr';
import { DailyBars } from '@ic/ui/charts';
import { Kpi, PageHeader } from '@ic/ui/components';
import { inr } from '@ic/ui/format';
import { Gate } from '@/lib/rider';

interface Earnings {
  rates: { delivery: number; returnPickup: number };
  totals: { deliveries: number; pickups: number; earned: number; today: number; codCollected: number };
  daily: { date: string; deliveries: number; pickups: number; amount: number }[];
}

function EarningsView() {
  const { data } = useSWR<Earnings>('/rider/earnings', { refreshInterval: 30_000 });
  if (!data) return <div className="skeleton h-80" />;
  const t = data.totals;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Earnings" eyebrow="Your pay">
        <p className="mt-2 text-sm text-ink-mute">{inr(data.rates.delivery)} per delivery · {inr(data.rates.returnPickup)} per return pickup · paid weekly</p>
      </PageHeader>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Today" value={inr(t.today)} tone="good" />
        <Kpi label="All time" value={inr(t.earned)} />
        <Kpi label="Deliveries" value={t.deliveries} hint={`${t.pickups} return pickups`} />
        <Kpi label="Cash collected" value={inr(t.codCollected)} hint="COD handed to hub" />
      </div>
      <div className="mt-6">
        <DailyBars title="Earnings (₹)" data={data.daily.map((d) => ({ date: d.date, value: d.amount }))} format={(v) => inr(v)} />
      </div>
    </div>
  );
}

export default function Page() {
  return <Gate><EarningsView /></Gate>;
}
