'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { BellIcon, PackageIcon, TagIcon, TruckIcon, UserIcon, CashIcon } from '@/components/icons';
import { Empty } from '@/components/ui';
import { api } from '@/lib/api';
import { relative } from '@/lib/format';
import type { Notification, Paged } from '@/lib/types';

const ICON: Record<string, any> = { order: PackageIcon, shipment: TruckIcon, payment: CashIcon, promotion: TagIcon, account: UserIcon };

export default function NotificationsPage() {
  const { data, mutate } = useSWR<Paged<Notification> & { unread: number }>('/notifications?limit=50');
  const { mutate: g } = useSWRConfig();

  // Mark everything read once the customer has seen the list.
  useEffect(() => {
    if (data?.unread) {
      const t = setTimeout(() => api('/notifications/read-all', { method: 'POST' }).then(() => g('/notifications/unread-count')), 1500);
      return () => clearTimeout(t);
    }
  }, [data?.unread, g]);

  return (
    <div className="container-page max-w-3xl py-10">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-4xl">Notifications</h1>
        <Link href="/account#notifications" className="text-sm font-semibold underline">Preferences</Link>
      </div>
      <div className="mt-8">
        {!data && <div className="skeleton h-72" />}
        {data && !data.items.length && <Empty title="You’re all caught up" body="Order updates and offers will appear here." />}
        {!!data?.items.length && (
          <ul className="card divide-y divide-paper-line">
            {data.items.map((n) => {
              const Icon = ICON[n.type] ?? BellIcon;
              const inner = (
                <div className={clsx('flex gap-4 px-5 py-4 transition hover:bg-paper', !n.isRead && 'bg-clay-tint/40')}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-paper-warm text-clay"><Icon size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold">{n.title}</p>
                      <span className="shrink-0 text-xs text-ink-mute">{relative(n.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-soft">{n.body}</p>
                  </div>
                  {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-clay" aria-label="Unread" />}
                </div>
              );
              return <li key={n.id}>{n.deepLink ? <Link href={n.deepLink} onClick={() => api(`/notifications/${n.id}/read`, { method: 'POST' }).then(() => mutate())}>{inner}</Link> : inner}</li>;
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
