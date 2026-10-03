'use client';

import useSWR from 'swr';
import { api } from '@ic/ui/api';
import { Empty, PageHeader, ReturnCard, type ReturnRow, Spinner } from '@ic/ui/components';
import { useAction } from '@ic/ui/staff';
import { Gate } from '@/lib/gate';

function Returns() {
  const { data, mutate } = useSWR<ReturnRow[]>('/seller/returns', { refreshInterval: 30_000 });
  const { busy, run } = useAction();
  const receive = (r: ReturnRow) =>
    run(`r${r.id}`, async () => {
      await api(`/seller/returns/${r.id}/receive`, { method: 'POST' });
      await mutate();
    }, 'Received. The customer has been refunded and stock is back.');
  return (
    <>
      <PageHeader title="Returns" eyebrow="After-sales">
        <p className="mt-2 max-w-xl text-sm text-ink-mute">Approved returns are collected by our riders and brought to your pickup address. Confirm when you receive the item: we refund the customer and put the unit back in stock.</p>
      </PageHeader>
      <div className="space-y-4">
        {!data && <div className="skeleton h-40" />}
        {data?.length === 0 && <Empty title="No returns" body="When a customer returns something, you’ll see it here." />}
        {data?.map((r) => (
          <ReturnCard
            key={r.id}
            r={r}
            actions={r.status === 'picked_up' && (
              <button className="btn-primary" onClick={() => receive(r)} disabled={!!busy}>{busy === `r${r.id}` && <Spinner />} Mark received &amp; refund</button>
            )}
          />
        ))}
      </div>
    </>
  );
}

export default function Page() {
  return <Gate><Returns /></Gate>;
}
