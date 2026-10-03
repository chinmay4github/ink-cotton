'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@ic/ui/api';
import { Badge, Empty, Money, PageHeader, Spinner, Status, Tabs, Thumb } from '@ic/ui/components';
import { relative } from '@ic/ui/format';
import { useAction } from '@ic/ui/staff';
import { SHOP_URL } from '@/lib/app';

type T = 'pending_approval' | 'active' | 'inactive' | 'rejected';
interface Row {
  id: number; name: string; slug: string; status: T; featured: boolean; seller: string; category: string; department: string;
  price: number; mrp: number; image: string | null; stock: number; variants: number; rating: number; createdAt: string; rejectionReason: string | null;
}

export default function Page() {
  const [tab, setTab] = useState<T>('pending_approval');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const key = `/admin/products?status=${tab}&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const { data, mutate } = useSWR<{ items: Row[]; total: number; totalPages: number }>(key);
  const { data: pending } = useSWR<{ total: number }>('/admin/products?status=pending_approval', { refreshInterval: 30_000 });
  const { busy, run } = useAction();
  const act = (p: Row, action: string) => {
    const reason = action === 'reject' ? prompt(`Why is "${p.name}" not approved? (sent to the seller)`) : undefined;
    if (action === 'reject' && reason === null) return;
    run(`${action}${p.id}`, async () => { await api(`/admin/products/${p.id}/${action}`, { method: 'POST', json: { reason: reason || undefined } }); await mutate(); }, 'Saved');
  };
  return (
    <>
      <PageHeader title="Catalogue" eyebrow={`${data?.total ?? '…'} products`} />
      <Tabs<T> value={tab} onChange={(t) => { setTab(t); setPage(1); }} items={[{ value: 'pending_approval', label: 'To review', count: pending?.total }, { value: 'active', label: 'Live' }, { value: 'inactive', label: 'Hidden' }, { value: 'rejected', label: 'Rejected' }]} />
      <input className="input mt-4 max-w-sm" placeholder="Search products" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      <div className="mt-4 space-y-3">
        {!data && <div className="skeleton h-40" />}
        {data?.items.length === 0 && <Empty title={tab === 'pending_approval' ? 'Review queue is empty' : 'Nothing here'} />}
        {data?.items.map((p) => (
          <article key={p.id} className="card flex flex-wrap items-center gap-4 p-4">
            <Thumb src={p.image} className="h-20 w-16" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{p.name}</p><Status status={p.status} />{p.featured && <Badge tone="accent">Featured</Badge>}</div>
              <p className="text-xs capitalize text-ink-mute">{p.seller} · {p.department} · {p.category} · {p.variants} variants · {p.stock} units · added {relative(p.createdAt)}</p>
              <Money value={p.price} mrp={p.mrp} className="mt-1 text-sm" />
              {p.rejectionReason && <p className="text-xs text-clay">{p.rejectionReason}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {p.status === 'pending_approval' && <><button className="btn-primary px-4 py-2" disabled={!!busy} onClick={() => act(p, 'approve')}>{busy === `approve${p.id}` && <Spinner />} Approve</button><button className="btn-outline px-4 py-2" disabled={!!busy} onClick={() => act(p, 'reject')}>Reject</button></>}
              {p.status === 'active' && <>
                <a href={`${SHOP_URL}/p/${p.slug}`} target="_blank" className="btn-ghost">View</a>
                <button className="btn-outline px-4 py-2" disabled={!!busy} onClick={() => act(p, p.featured ? 'unfeature' : 'feature')}>{p.featured ? 'Unfeature' : 'Feature'}</button>
                <button className="btn-outline px-4 py-2" disabled={!!busy} onClick={() => act(p, 'deactivate')}>Hide</button>
              </>}
              {(p.status === 'inactive' || p.status === 'rejected') && <button className="btn-outline px-4 py-2" disabled={!!busy} onClick={() => act(p, 'activate')}>Make live</button>}
            </div>
          </article>
        ))}
      </div>
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button className="btn-outline px-4 py-2" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {data.totalPages}</span>
          <button className="btn-outline px-4 py-2" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
