'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { Empty, PageHeader, ReturnCard, type ReturnRow, Status } from '@ic/ui/components';
import { date, inr } from '@ic/ui/format';
import { Gate, type Job } from '@/lib/rider';

function History() {
  const { data } = useSWR<Job[]>('/rider/jobs?scope=done');
  const { data: returns } = useSWR<ReturnRow[]>('/rider/returns');
  const doneReturns = returns?.filter((r) => r.status === 'completed' || r.status === 'picked_up') ?? [];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="History" eyebrow="Completed work" />
      {!data && <div className="skeleton h-40" />}
      {data?.length === 0 && doneReturns.length === 0 && <Empty title="Nothing yet" body="Completed deliveries will show up here." />}
      <ul className="card divide-y divide-paper-line">
        {data?.map((j) => (
          <li key={j.id}>
            <Link href={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper/60">
              <span>
                <span className="block text-sm font-semibold">{j.orderNumber}</span>
                <span className="block text-xs text-ink-mute">{j.drop?.city} · {j.deliveredAt ? date(j.deliveredAt, true) : '—'}</span>
              </span>
              <span className="flex items-center gap-3"><span className="text-sm font-semibold">{inr(j.payout)}</span><Status status={j.status} /></span>
            </Link>
          </li>
        ))}
      </ul>
      {doneReturns.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-[0.14em]">Return pickups</h2>
          <div className="space-y-3">{doneReturns.map((r) => <ReturnCard key={r.id} r={r} />)}</div>
        </>
      )}
    </div>
  );
}

export default function Page() {
  return <Gate><History /></Gate>;
}
