'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@ic/ui/api';
import { Empty, PageHeader, ReturnCard, type ReturnRow, Spinner, Tabs } from '@ic/ui/components';
import { useAction } from '@ic/ui/staff';

type T = 'requested' | 'approved' | 'picked_up' | 'completed' | 'rejected';

export default function Page() {
  const [tab, setTab] = useState<T>('requested');
  const { data, mutate } = useSWR<ReturnRow[]>('/admin/returns', { refreshInterval: 30_000 });
  const { busy, run } = useAction();
  const act = (r: ReturnRow, action: 'approve' | 'reject') => run(`${action}${r.id}`, async () => { await api(`/admin/returns/${r.id}/${action}`, { method: 'POST' }); await mutate(); }, action === 'approve' ? 'Approved. Riders can now pick it up.' : 'Rejected');
  const rows = data?.filter((r) => r.status === tab) ?? [];
  const count = (t: T) => data?.filter((r) => r.status === t).length;
  return (
    <>
      <PageHeader title="Returns" eyebrow="After-sales" />
      <Tabs<T> value={tab} onChange={setTab} items={[{ value: 'requested', label: 'To review', count: count('requested') }, { value: 'approved', label: 'Awaiting pickup', count: count('approved') }, { value: 'picked_up', label: 'In transit', count: count('picked_up') }, { value: 'completed', label: 'Refunded' }, { value: 'rejected', label: 'Rejected' }]} />
      <div className="mt-6 space-y-3">
        {!data && <div className="skeleton h-40" />}
        {data && rows.length === 0 && <Empty title="Nothing here" />}
        {rows.map((r) => (
          <ReturnCard key={r.id} r={r} showAddresses="both" actions={r.status === 'requested' && (
            <><button className="btn-primary px-4 py-2" disabled={!!busy} onClick={() => act(r, 'approve')}>{busy === `approve${r.id}` && <Spinner />} Approve return</button><button className="btn-outline px-4 py-2" disabled={!!busy} onClick={() => act(r, 'reject')}>Reject</button></>
          )} />
        ))}
      </div>
    </>
  );
}
