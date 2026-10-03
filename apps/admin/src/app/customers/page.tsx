'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Empty, PageHeader, Status } from '@ic/ui/components';
import { date, inr, relative } from '@ic/ui/format';

interface Customer { id: number; name: string; email: string | null; phone: string | null; status: string; joined: string; lastLogin: string | null; orders: number; spend: number }

export default function Page() {
  const [q, setQ] = useState('');
  const { data } = useSWR<Customer[]>(`/admin/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  return (
    <>
      <PageHeader title="Customers" eyebrow="Shoppers" />
      <input className="input mb-4 max-w-sm" placeholder="Name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      {!data && <div className="skeleton h-40" />}
      {data?.length === 0 && <Empty title="No customers match" />}
      {data && data.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-paper-warm text-left text-xs uppercase tracking-wider text-ink-mute"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Spend</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-paper-line">
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.name}<span className="block text-xs font-normal text-ink-mute">{c.email} {c.phone ? `· ${c.phone}` : ''}</span></td>
                  <td className="px-4 py-3 tabular-nums">{c.orders}</td>
                  <td className="px-4 py-3">{inr(c.spend)}</td>
                  <td className="px-4 py-3">{date(c.joined)}<span className="block text-xs text-ink-mute">{c.lastLogin ? `seen ${relative(c.lastLogin)}` : 'never signed in'}</span></td>
                  <td className="px-4 py-3"><Status status={c.status === 'active' ? 'active' : 'suspended'} label={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
