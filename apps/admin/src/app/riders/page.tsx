'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@ic/ui/api';
import { Badge, Empty, PageHeader, Spinner, Status, Tabs } from '@ic/ui/components';
import { date } from '@ic/ui/format';
import { useAction } from '@ic/ui/staff';

type T = 'pending' | 'approved' | 'suspended' | 'rejected';
interface Rider {
  id: number; name: string; email: string | null; phone: string | null; status: T; isAvailable: boolean; vehicleType: string | null; vehicleNumber: string | null;
  pincodes: string[]; rating: number; delivered: number; activeJobs: number; createdAt: string;
}

export default function Page() {
  const [tab, setTab] = useState<T>('pending');
  const { data, mutate } = useSWR<Rider[]>('/admin/riders', { refreshInterval: 30_000 });
  const { busy, run } = useAction();
  const act = (r: Rider, action: string) => run(`${action}${r.id}`, async () => { await api(`/admin/riders/${r.id}/${action}`, { method: 'POST' }); await mutate(); }, `${r.name}: ${action}d`);
  const rows = data?.filter((r) => r.status === tab) ?? [];
  const count = (t: T) => data?.filter((r) => r.status === t).length;
  return (
    <>
      <PageHeader title="Riders" eyebrow="Delivery fleet" />
      <Tabs<T> value={tab} onChange={setTab} items={[{ value: 'pending', label: 'Applications', count: count('pending') }, { value: 'approved', label: 'Active', count: count('approved') }, { value: 'suspended', label: 'Suspended', count: count('suspended') }, { value: 'rejected', label: 'Rejected', count: count('rejected') }]} />
      <div className="mt-6 space-y-3">
        {!data && <div className="skeleton h-40" />}
        {data && rows.length === 0 && <Empty title="Nothing here" />}
        {rows.map((r) => (
          <article key={r.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <div className="flex items-center gap-2"><p className="font-semibold">{r.name}</p><Status status={r.status} />{r.status === 'approved' && (r.isAvailable ? <Badge tone="good">Online</Badge> : <Badge>Offline</Badge>)}</div>
              <p className="text-sm capitalize text-ink-soft">{r.vehicleType} · {r.vehicleNumber} · covers {r.pincodes.join(', ') || '—'}</p>
              <p className="text-xs text-ink-mute">{r.email} · {r.phone} · joined {date(r.createdAt)}</p>
              {r.status === 'approved' && <p className="mt-1 text-xs">{r.delivered} delivered · {r.activeJobs} active · ★ {r.rating.toFixed(1)}</p>}
            </div>
            <div className="flex gap-2">
              {r.status === 'pending' && <><button className="btn-primary px-4 py-2" disabled={!!busy} onClick={() => act(r, 'approve')}>{busy === `approve${r.id}` && <Spinner />} Approve</button><button className="btn-outline px-4 py-2" disabled={!!busy} onClick={() => act(r, 'reject')}>Reject</button></>}
              {r.status === 'approved' && <button className="btn-outline px-4 py-2" disabled={!!busy} onClick={() => act(r, 'suspend')}>Suspend</button>}
              {r.status === 'suspended' && <button className="btn-outline px-4 py-2" disabled={!!busy} onClick={() => act(r, 'reinstate')}>Reinstate</button>}
              {r.status === 'rejected' && <button className="btn-outline px-4 py-2" disabled={!!busy} onClick={() => act(r, 'approve')}>Approve</button>}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
