'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import useSWR from 'swr';
import { api } from '@ic/ui/api';
import { Empty, Money, PageHeader, Status, Tabs, Thumb } from '@ic/ui/components';
import { useAction } from '@ic/ui/staff';
import { Gate } from '@/lib/gate';

type Filter = 'all' | 'active' | 'pending_approval' | 'inactive' | 'low';
interface Row {
  id: number; name: string; slug: string; status: string; department: string; category: string; price: number; mrp: number; image: string | null;
  rating: number; ratingCount: number; variants: number; stock: number; lowStock: number; rejectionReason: string | null;
}

function Products() {
  const initial = (useSearchParams().get('filter') as Filter) ?? 'all';
  const [filter, setFilter] = useState<Filter>(initial);
  const [q, setQ] = useState('');
  const { data, mutate } = useSWR<Row[]>('/seller/products');
  const { busy, run } = useAction();

  const rows = useMemo(() => {
    let r = data ?? [];
    if (filter === 'low') r = r.filter((p) => p.lowStock > 0);
    else if (filter !== 'all') r = r.filter((p) => p.status === filter || (filter === 'inactive' && p.status === 'rejected'));
    if (q) r = r.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    return r;
  }, [data, filter, q]);
  const count = (f: (p: Row) => boolean) => data?.filter(f).length;

  const toggle = (p: Row) =>
    run(`t${p.id}`, async () => {
      await api(`/seller/products/${p.id}`, { method: 'PATCH', json: { status: p.status === 'active' ? 'inactive' : 'active' } });
      await mutate();
    }, p.status === 'active' ? 'Hidden from the shop' : 'Live in the shop');

  return (
    <>
      <PageHeader title="Products" eyebrow="Catalogue" actions={<Link href="/products/new" className="btn-primary">Add product</Link>} />
      <Tabs<Filter>
        value={filter}
        onChange={setFilter}
        items={[
          { value: 'all', label: 'All', count: data?.length },
          { value: 'active', label: 'Live', count: count((p) => p.status === 'active') },
          { value: 'pending_approval', label: 'In review', count: count((p) => p.status === 'pending_approval') },
          { value: 'inactive', label: 'Hidden / rejected', count: count((p) => p.status === 'inactive' || p.status === 'rejected') },
          { value: 'low', label: 'Low stock', count: count((p) => p.lowStock > 0) },
        ]}
      />
      <input className="input mt-4 max-w-sm" placeholder="Search your products" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4">
        {!data && <div className="skeleton h-64" />}
        {data && rows.length === 0 && <Empty title="No products" body="Add your first product. It goes live once our team approves it." action={<Link href="/products/new" className="btn-primary">Add product</Link>} />}
        {rows.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-paper-warm text-left text-xs uppercase tracking-wider text-ink-mute">
                <tr><th className="px-4 py-3 font-semibold">Product</th><th className="hidden px-4 py-3 font-semibold md:table-cell">Price</th><th className="hidden px-4 py-3 font-semibold sm:table-cell">Stock</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-paper/60">
                    <td className="px-4 py-3">
                      <Link href={`/products/${p.id}`} className="flex items-center gap-3">
                        <Thumb src={p.image} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium hover:underline">{p.name}</span>
                          <span className="block text-xs capitalize text-ink-mute">{p.department} · {p.category} · {p.variants} variants</span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell"><Money value={p.price} mrp={p.mrp} /></td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span className="tabular-nums">{p.stock}</span>
                      {p.lowStock > 0 && <span className="ml-2 text-xs font-semibold text-clay">{p.lowStock} low</span>}
                    </td>
                    <td className="px-4 py-3"><Status status={p.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {['active', 'inactive'].includes(p.status) && (
                        <button onClick={() => toggle(p)} disabled={!!busy} className="text-xs font-semibold text-ink-soft underline hover:text-ink">
                          {p.status === 'active' ? 'Hide' : 'Show'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return <Gate><Suspense><Products /></Suspense></Gate>;
}
