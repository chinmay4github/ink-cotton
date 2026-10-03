'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@ic/ui/api';
import { Empty, PageHeader, Spinner, Status, Tabs } from '@ic/ui/components';
import { date, inr } from '@ic/ui/format';
import { useAction } from '@ic/ui/staff';

type T = 'pending' | 'approved' | 'suspended' | 'rejected';
interface Seller {
  id: number; displayName: string; businessName: string; status: T; gstin: string | null; owner: string; email: string | null; phone: string | null;
  city: string | null; state: string | null; products: number; commissionPct: number; sales: number; createdAt: string; rejectionReason: string | null;
}

export default function Page() {
  const [tab, setTab] = useState<T>('pending');
  const { data, mutate } = useSWR<Seller[]>('/admin/sellers');
  const { busy, run } = useAction();
  const act = (s: Seller, action: string, needsReason = false) => {
    const reason = needsReason ? prompt(`Reason (sent to ${s.displayName})`) : undefined;
    if (needsReason && reason === null) return;
    run(`${action}${s.id}`, async () => { await api(`/admin/sellers/${s.id}/${action}`, { method: 'POST', json: { reason: reason || undefined } }); await mutate(); }, `${s.displayName}: ${action}d`);
  };
  const rows = data?.filter((s) => s.status === tab) ?? [];
  const count = (t: T) => data?.filter((s) => s.status === t).length;
  return (
    <>
      <PageHeader title="Sellers" eyebrow="Marketplace" />
      <Tabs<T> value={tab} onChange={setTab} items={[{ value: 'pending', label: 'Applications', count: count('pending') }, { value: 'approved', label: 'Active', count: count('approved') }, { value: 'suspended', label: 'Suspended', count: count('suspended') }, { value: 'rejected', label: 'Rejected', count: count('rejected') }]} />
      <div className="mt-6 space-y-3">
        {!data && <div className="skeleton h-40" />}
        {data && rows.length === 0 && <Empty title="Nothing here" />}
        {rows.map((s) => (
          <article key={s.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><p className="font-semibold">{s.displayName}</p><Status status={s.status} /></div>
              <p className="text-sm text-ink-soft">{s.businessName}{s.gstin ? ` · GSTIN ${s.gstin}` : ''}</p>
              <p className="text-xs text-ink-mute">{s.owner} · {s.email} · {s.phone} · {s.city}, {s.state} · applied {date(s.createdAt)}</p>
              {s.status === 'approved' && <p className="mt-1 text-xs">{s.products} products · {inr(s.sales)} sales · {s.commissionPct}% commission</p>}
              {s.rejectionReason && <p className="mt-1 text-xs text-clay">{s.rejectionReason}</p>}
            </div>
            <div className="flex gap-2">
              {s.status === 'pending' && <><button className="btn-primary px-4 py-2" disabled={!!busy} onClick={() => act(s, 'approve')}>{busy === `approve${s.id}` && <Spinner />} Approve</button><button className="btn-outline px-4 py-2" disabled={!!busy} onClick={() => act(s, 'reject', true)}>Reject</button></>}
              {s.status === 'approved' && <button className="btn-outline px-4 py-2" disabled={!!busy} onClick={() => act(s, 'suspend', true)}>Suspend</button>}
              {(s.status === 'suspended' || s.status === 'rejected') && <button className="btn-outline px-4 py-2" disabled={!!busy} onClick={() => act(s, s.status === 'rejected' ? 'approve' : 'reinstate')}>{s.status === 'rejected' ? 'Approve' : 'Reinstate'}</button>}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
