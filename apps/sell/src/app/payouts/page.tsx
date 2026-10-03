'use client';

import useSWR from 'swr';
import { Empty, Kpi, PageHeader, Status } from '@ic/ui/components';
import { date, inr } from '@ic/ui/format';
import { Gate } from '@/lib/gate';

interface Payouts {
  commissionPct: number; deliveredItems: number; gross: number; commission: number; net: number;
  refunds: { items: number; amount: number }; paidOut: number; balance: number;
  payouts: { id: number; periodStart: string; periodEnd: string; gross: number; commission: number; net: number; status: string; reference: string | null; paidAt: string | null }[];
}

function PayoutView() {
  const { data } = useSWR<Payouts>('/seller/payouts');
  if (!data) return <div className="skeleton h-80" />;
  return (
    <>
      <PageHeader title="Payouts" eyebrow="Money">
        <p className="mt-2 text-sm text-ink-mute">Earnings count once an order is delivered. Settled weekly to your bank account.</p>
      </PageHeader>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Delivered sales" value={inr(data.gross)} hint={`${data.deliveredItems} items`} />
        <Kpi label="Commission" value={inr(data.commission)} hint={`${data.commissionPct}% platform fee`} />
        <Kpi label="Net earnings" value={inr(data.net)} tone="good" />
        <Kpi label="Next payout" value={inr(data.balance)} hint={data.refunds.items ? `${data.refunds.items} refunded item(s) excluded` : 'Pending settlement'} />
      </div>
      <h2 className="mb-3 mt-8 text-sm font-semibold">Settlement history</h2>
      {data.payouts.length === 0 ? (
        <Empty title="No settlements yet" body="Your first payout is sent at the end of the week after your first delivery." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-paper-warm text-left text-xs uppercase tracking-wider text-ink-mute"><tr><th className="px-4 py-3">Period</th><th className="px-4 py-3">Gross</th><th className="px-4 py-3">Commission</th><th className="px-4 py-3">Net</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-paper-line">
              {data.payouts.map((p) => (
                <tr key={p.id}><td className="px-4 py-3">{date(p.periodStart)} – {date(p.periodEnd)}</td><td className="px-4 py-3">{inr(p.gross)}</td><td className="px-4 py-3">{inr(p.commission)}</td><td className="px-4 py-3 font-semibold">{inr(p.net)}</td><td className="px-4 py-3"><Status status={p.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return <Gate><PayoutView /></Gate>;
}
